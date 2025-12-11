<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

class Woo {
  const META_VOUCHER_CODE = '_vms_voucher_code';

  public static function init(){
    if ( ! class_exists('WooCommerce') || ! function_exists('wc_get_order') ) return;
    add_action('woocommerce_order_status_completed', [__CLASS__, 'handle_completed_order'], 10, 1);
  }

  protected static function build_products_payload( $order, $multiplier ){
    $items = [];
    foreach ( $order->get_items() as $item ) {
      $product = $item->get_product();
      $items[] = [
        'product_id'    => $product ? (string) $product->get_id() : '',
        'product_name'  => $item->get_name(),
        'product_price' => round((float) $item->get_total() * $multiplier, 2),
      ];
    }
    return $items;
  }

  protected static function build_payload( $order ){
    $multiplier = (float) get_option(Settings::OPT_MULTIPLIER, '1.0');
    if ($multiplier <= 0) $multiplier = 1.0;
    $total = round((float) $order->get_total() * $multiplier, 2);
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
      'order_products'    => self::build_products_payload($order, $multiplier),
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

    if ( ! API::base() ) return;

    if ( $order->get_meta(self::META_VOUCHER_CODE) ) return; // already synced

    $payload = self::build_payload($order);
    $response = API::request('POST', 'vouchers', $payload);
    if ( is_wp_error($response) ) {
      error_log('[VMS Admin] Failed to create voucher for order '.$order_id.': '.$response->get_error_message());
      return;
    }
    if ( empty($response['code']) ) {
      error_log('[VMS Admin] Voucher creation returned unexpected response for order '.$order_id);
      return;
    }

    $order->update_meta_data(self::META_VOUCHER_CODE, sanitize_text_field($response['code']));
    $order->save();
  }
}
