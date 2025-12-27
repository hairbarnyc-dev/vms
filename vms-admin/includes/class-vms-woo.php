<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

class Woo {
  const META_VOUCHER_CODE = '_vms_voucher_code';
  const DEBUG_LOG = 'debug.log';

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

  protected static function build_products_payload( $order, $multiplier, $cat_id ){
    $items = [];
    $sum = 0.0;
    foreach ( $order->get_items() as $item ) {
      if ( ! self::item_in_category($item, $cat_id) ) continue;
      $product = $item->get_product();
      $line_subtotal = (float) $item->get_subtotal();
      if ($line_subtotal <= 0) $line_subtotal = (float) $item->get_total();
      $sum += $line_subtotal;
      $items[] = [
        'product_id'    => $product ? (string) $product->get_id() : '',
        'product_name'  => $item->get_name(),
        'product_price' => round($line_subtotal * $multiplier, 2),
      ];
    }
    return [$items, $sum];
  }

  protected static function build_payload( $order ){
    $multiplier = (float) get_option(Settings::OPT_MULTIPLIER, '1.0');
    if ($multiplier <= 0) $multiplier = 1.0;
    $cat_id = (int) get_option(Settings::OPT_CAT_ID, 0);
    [$items, $sum] = self::build_products_payload($order, $multiplier, $cat_id);
    if ( $cat_id > 0 && empty($items) ) return null;
    $total = round($sum * $multiplier, 2);
    $order_number = $order->get_order_number();
    $site_url = home_url();
    $site_host = wp_parse_url($site_url, PHP_URL_HOST);
    $source_label = $site_host ? $site_host : $site_url;
    return [
      'title'             => sprintf(__('Voucher for Order #%s','vms-admin'), $order_number),
      'source'            => $site_url,
      'order_external_id' => sprintf('%s:%s', $source_label, $order->get_id()),
      'order_id'          => (string) $order_number,
      'order_total'       => $total,
      'order_products'    => $items,
      'face_value'        => $total,
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

    if ( $order->get_meta(self::META_VOUCHER_CODE) ) {
      self::log_line('Voucher already exists', ['order_id' => (int) $order_id]);
      return; // already synced
    }

    $payload = self::build_payload($order);
    if ( empty($payload) ) {
      self::log_line('No matching items for voucher', ['order_id' => (int) $order_id]);
      return;
    }
    self::log_line('Voucher payload ready', ['order_id' => (int) $order_id, 'items' => count($payload['order_products'])]);
    $response = API::request('POST', 'vouchers', $payload);
    if ( is_wp_error($response) ) {
      self::log_line('Voucher API wp_error', ['order_id' => (int) $order_id, 'message' => $response->get_error_message()]);
      error_log('[VMS Admin] Failed to create voucher for order '.$order_id.': '.$response->get_error_message());
      return;
    }
    if ( empty($response['code']) ) {
      self::log_line('Voucher API unexpected response', ['order_id' => (int) $order_id]);
      error_log('[VMS Admin] Voucher creation returned unexpected response for order '.$order_id);
      return;
    }

    $order->update_meta_data(self::META_VOUCHER_CODE, sanitize_text_field($response['code']));
    $order->save();
    self::log_line('Voucher created', ['order_id' => (int) $order_id, 'code' => $response['code']]);
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
