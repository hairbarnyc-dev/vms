<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

class Woo {
  const META_VOUCHER_CODE = '_vms_voucher_code';
  const DEBUG_LOG = 'debug.log';
  const ITEM_META_CODES = '_vms_voucher_codes';

  public static function init(){
    if ( ! class_exists('WooCommerce') || ! function_exists('wc_get_order') ) return;
    add_action('woocommerce_checkout_order_processed', [__CLASS__, 'handle_completed_order'], 10, 1);
  }

  protected static function item_in_category( $item, $cat_id ){
    if ( $cat_id <= 0 ) return true;
    if ( ! taxonomy_exists('product_cat') ) return false;
    $product_id = (int) $item->get_product_id();
    if ( $product_id <= 0 ) return false;
    if ( has_term($cat_id, 'product_cat', $product_id) ) return true;
    $children = get_term_children($cat_id, 'product_cat');
    if ( is_wp_error($children) || empty($children) ) return false;
    $children = array_map('intval', $children);
    return has_term($children, 'product_cat', $product_id);
  }

  protected static function build_item_payload( $order, $item, $multiplier, $unit_total ){
    $product = $item->get_product();
    $order_number = $order->get_order_number();
    $site_url = home_url();
    $site_host = wp_parse_url($site_url, PHP_URL_HOST);
    $source_label = $site_host ? $site_host : $site_url;
    $value = round($unit_total * $multiplier, 2);
    return [
      'title'             => $item->get_name(),
      'source'            => $site_url,
      'order_external_id' => sprintf('%s:%s', $source_label, $order->get_id()),
      'order_id'          => (string) $order_number,
      'order_total'       => $value,
      'order_products'    => [[
        'product_id'    => $product ? (string) $product->get_id() : '',
        'product_name'  => $item->get_name(),
        'product_price' => $value,
      ]],
      'face_value'        => $value,
      'currency'          => $order->get_currency(),
      'customer'          => [
        'email'      => $order->get_billing_email(),
        'phone'      => $order->get_billing_phone(),
        'first_name' => $order->get_billing_first_name(),
        'last_name'  => $order->get_billing_last_name(),
      ],
    ];
  }

  public static function handle_completed_order( $order_id ){
    $order = wc_get_order($order_id);
    if ( ! $order ) return;
    self::log_line('Order completed hook', ['order_id' => (int) $order_id]);

    if ( ! API::base() ) {
      self::log_line('API base missing');
      return;
    }

    $multiplier = (float) get_option(Settings::OPT_MULTIPLIER, '1.0');
    if ($multiplier <= 0) $multiplier = 1.0;
    $cat_id = (int) get_option(Settings::OPT_CAT_ID, 0);
    $created = 0;

    foreach ( $order->get_items() as $item_id => $item ) {
      if ( ! self::item_in_category($item, $cat_id) ) continue;
      $qty = max(1, (int) $item->get_quantity());
      $line_total = (float) $item->get_total(); // post-coupon amount
      $unit_total = $qty > 0 ? ($line_total / $qty) : $line_total;
      if ($unit_total <= 0) {
        self::log_line('Skip zero-value item', ['order_id' => (int) $order_id, 'item_id' => (int) $item_id]);
        continue;
      }

      $codes = $item->get_meta(self::ITEM_META_CODES, true);
      if (!is_array($codes)) $codes = $codes ? [$codes] : [];
      $existing_count = count($codes);

      for ($i = $existing_count; $i < $qty; $i++) {
        $payload = self::build_item_payload($order, $item, $multiplier, $unit_total);
        if ( empty($payload) ) continue;
        self::log_line('Voucher payload ready', ['order_id' => (int) $order_id, 'item_id' => (int) $item_id, 'unit' => $i + 1]);
        $response = API::request('POST', 'vouchers', $payload);
        if ( is_wp_error($response) ) {
          self::log_line('Voucher API wp_error', ['order_id' => (int) $order_id, 'item_id' => (int) $item_id, 'message' => $response->get_error_message()]);
          error_log('[VMS Admin] Failed to create voucher for order '.$order_id.': '.$response->get_error_message());
          continue;
        }
        if ( empty($response['code']) ) {
          self::log_line('Voucher API unexpected response', ['order_id' => (int) $order_id, 'item_id' => (int) $item_id]);
          error_log('[VMS Admin] Voucher creation returned unexpected response for order '.$order_id);
          continue;
        }
        $codes[] = sanitize_text_field($response['code']);
        $created++;
      }

      if (!empty($codes)) {
        $item->update_meta_data(self::ITEM_META_CODES, $codes);
      }
    }

    $order->save();
    self::log_line('Vouchers created', ['order_id' => (int) $order_id, 'count' => $created]);
  }

  protected static function log_line($message, $context = []){
    if (empty($message)) return;
    $line = '[' . gmdate('Y-m-d H:i:s') . '] ' . $message;
    if (!empty($context)) $line .= ' ' . wp_json_encode($context);
    $line .= "\n";
    $path = defined('VMS_ADMIN_PATH') ? VMS_ADMIN_PATH . self::DEBUG_LOG : '';
    if (!$path) return;
    @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
  }
}
