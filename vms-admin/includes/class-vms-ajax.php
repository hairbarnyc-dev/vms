<?php
namespace VMS_Admin;
if ( ! defined('ABSPATH') ) { exit; }
class Ajax {
public static function init(){
add_action('wp_ajax_vms_fetch_salons', [__CLASS__,'fetch_salons']);
add_action('wp_ajax_vms_fetch_vouchers', [__CLASS__,'fetch_vouchers']);
add_action('wp_ajax_vms_fetch_voucher_details',
[__CLASS__,'fetch_voucher_details']);
add_action('wp_ajax_vms_redeem_voucher', [__CLASS__,'redeem_voucher']);
add_action('wp_ajax_vms_void_voucher', [__CLASS__,'void_voucher']);
}
protected static function check_nonce(){
  check_ajax_referer('vms_admin_nonce','nonce');
  // If you switched to custom cap earlier, ensure your user has it
  if ( ! current_user_can('manage_options') /* or 'vms_manage' */ ) wp_send_json_error('forbidden', 403);
}
public static function fetch_salons(){
  self::check_nonce();
  $api = API::salons();
  if (is_wp_error($api)) wp_send_json_error($api->get_error_data(), 400);

  // ✅ Unwrap: API may return { success:true, data:[...] } or just [...]
  $list = is_array($api) && array_key_exists('data', $api) ? $api['data'] : $api;
  if (!is_array($list)) $list = [];

  wp_send_json_success($list);
}
public static function fetch_vouchers(){
self::check_nonce();
$query = [
'page' => isset($_POST['page']) ? absint($_POST['page']) : '',
'pageSize' => isset($_POST['pageSize']) ? absint($_POST['pageSize']) : '',
'status' => isset($_POST['status']) ?
sanitize_text_field($_POST['status']) : '',
'salon_id' => (isset($_POST['salon_id']) && $_POST['salon_id'] !== '') ? absint($_POST['salon_id']) : '',
'q' => isset($_POST['q']) ? sanitize_text_field($_POST['q']) : '',
'date_from' => isset($_POST['date_from']) ?
sanitize_text_field($_POST['date_from']) : '',
'date_to' => isset($_POST['date_to']) ?
sanitize_text_field($_POST['date_to']) : '',
];
$data = API::vouchers(array_filter($query, fn($v)=>$v!=='' && $v!==null));
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
$list = is_array($data) && array_key_exists('data', $data) ? $data['data'] : $data;
if (is_array($list)) {
  $list = array_map([__CLASS__, 'augment_voucher_list_item'], $list);
}
wp_send_json_success($list);
}
public static function fetch_voucher_details(){
self::check_nonce();
$code = isset($_POST['code']) ? sanitize_text_field($_POST['code']) : '';
if (!$code) wp_send_json_error('missing code', 400);
$data = API::voucherByCode($code);
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
$data = self::augment_with_wc_order($data);
wp_send_json_success($data);
}
public static function redeem_voucher(){
self::check_nonce();
$code = sanitize_text_field($_POST['code'] ?? '');
$salon = absint($_POST['salon_id'] ?? 0);
$notes = sanitize_text_field($_POST['notes'] ?? '');
if (!$code || !$salon) wp_send_json_error('missing code/salon', 400);
$data = API::redeem($code, $salon, $notes);
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
wp_send_json_success($data);
}
public static function void_voucher(){
self::check_nonce();
$code = sanitize_text_field($_POST['code'] ?? '');
$notes = sanitize_text_field($_POST['notes'] ?? '');
if (!$code) wp_send_json_error('missing code', 400);
$data = API::void($code, $notes);
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
wp_send_json_success($data);
}

protected static function augment_with_wc_order($data){
  if (!is_array($data) || !class_exists('WooCommerce') || !function_exists('wc_get_order')) return $data;
  $code = !empty($data['code']) ? (string) $data['code'] : '';
  $voucher_value = isset($data['face_value']) ? (float) $data['face_value'] : 0.0;
  $external = '';
  if (!empty($data['order']['external_id'])) $external = (string) $data['order']['external_id'];
  if (!$external && !empty($data['order_external_id'])) $external = (string) $data['order_external_id'];
  $order_id = 0;
  if ($external && strpos($external, ':') !== false) {
    $parts = explode(':', $external);
    $order_id = absint(end($parts));
  }
  if (!$order_id && !empty($data['order']['order_id']) && is_numeric($data['order']['order_id'])) {
    $order_id = absint($data['order']['order_id']);
  }
  if (!$order_id && !empty($data['order_id']) && is_numeric($data['order_id'])) {
    $order_id = absint($data['order_id']);
  }
  if (!$order_id) return $data;
  $order = wc_get_order($order_id);
  if (!$order) return $data;

  $first = null;
  foreach ($order->get_items() as $item) { $first = $item; break; }
  $matched = self::find_item_for_voucher($order, $code, $voucher_value);
  $target = $matched ?: $first;
  $product = $target ? $target->get_product() : null;
  $qty = $target ? max(1, (int) $target->get_quantity()) : 1;
  $unit = $target ? ((float) $target->get_total() / $qty) : 0;
  $img_id = $product ? $product->get_image_id() : 0;
  $img_url = $img_id ? wp_get_attachment_image_url($img_id, 'medium') : '';
  $desc = $product ? ($product->get_short_description() ?: $product->get_description()) : '';
  $products = [];
  foreach ($order->get_items() as $item) {
    $qty = max(1, (int) $item->get_quantity());
    $p = $item->get_product();
    $unit = $qty ? ((float) $item->get_total() / $qty) : 0;
    $products[] = [
      'product_id' => $p ? $p->get_sku() : '',
      'product_name' => $p ? $p->get_name() : $item->get_name(),
      'product_price' => number_format($unit, 2, '.', ''),
      'quantity' => $qty,
    ];
  }
  if (!isset($data['order']) || !is_array($data['order'])) $data['order'] = [];
  $data['order']['products'] = $products;
  $data['order']['order_total'] = (string) $order->get_total();
  $data['order']['subtotal'] = (string) $order->get_subtotal();
  $data['wp'] = [
    'order_id' => $order->get_id(),
    'order_number' => $order->get_order_number(),
    'customer_name' => trim($order->get_billing_first_name().' '.$order->get_billing_last_name()),
    'customer_email' => $order->get_billing_email(),
    'product_name' => $product ? $product->get_name() : ($target ? $target->get_name() : ''),
    'product_sku' => $product ? $product->get_sku() : ($target ? $target->get_product_id() : ''),
    'product_description' => wp_strip_all_tags($desc),
    'product_image' => $img_url,
    'product_price' => number_format($unit, 2, '.', ''),
  ];
  return $data;
}

protected static function augment_voucher_list_item($item){
  if (!is_array($item) || !class_exists('WooCommerce') || !function_exists('wc_get_order')) return $item;
  $code = !empty($item['code']) ? (string) $item['code'] : '';
  $voucher_value = isset($item['face_value']) ? (float) $item['face_value'] : 0.0;
  $external = '';
  if (!empty($item['order_external_id'])) $external = (string) $item['order_external_id'];
  if (!$external && !empty($item['order']['external_id'])) $external = (string) $item['order']['external_id'];
  $order_id = 0;
  if ($external && strpos($external, ':') !== false) {
    $parts = explode(':', $external);
    $order_id = absint(end($parts));
  }
  if (!$order_id && !empty($item['order_number']) && is_numeric($item['order_number'])) {
    $order_id = absint($item['order_number']);
  }
  if (!$order_id && !empty($item['order_id']) && is_numeric($item['order_id'])) {
    $order_id = absint($item['order_id']);
  }
  if (!$order_id) return $item;
  $order = wc_get_order($order_id);
  if (!$order) return $item;

  $first = null;
  foreach ($order->get_items() as $i) { $first = $i; break; }
  $matched = self::find_item_for_voucher($order, $code, $voucher_value);
  $target = $matched ?: $first;
  $product = $target ? $target->get_product() : null;
  $qty = $target ? max(1, (int) $target->get_quantity()) : 1;
  $unit = $target ? ((float) $target->get_total() / $qty) : 0;
  $customer_id = $order->get_customer_id();
  $item['wp'] = [
    'order_id' => $order->get_id(),
    'order_number' => $order->get_order_number(),
    'customer_name' => trim($order->get_billing_first_name().' '.$order->get_billing_last_name()),
    'customer_email' => $order->get_billing_email(),
    'customer_id' => $customer_id,
    'customer_link' => $customer_id ? admin_url('user-edit.php?user_id='.$customer_id) : '',
    'product_name' => $product ? $product->get_name() : ($target ? $target->get_name() : ''),
    'product_sku' => $product ? $product->get_sku() : '',
    'product_price' => number_format($unit, 2, '.', ''),
    'grand_total' => number_format((float) $order->get_total(), 2, '.', ''),
  ];
  return $item;
}

protected static function find_item_for_voucher($order, $code, $voucher_value = 0.0){
  if (!$order) return null;
  foreach ($order->get_items() as $item) {
    if ($code) {
      $codes = $item->get_meta(Woo::ITEM_META_CODES, true);
      if (!is_array($codes)) $codes = $codes ? [$codes] : [];
      if (in_array($code, $codes, true)) return $item;
      $single = $item->get_meta(Woo::META_VOUCHER_CODE, true);
      if ($single && $single === $code) return $item;
    }
  }
  if ($voucher_value > 0) {
    $best = null;
    $best_diff = null;
    foreach ($order->get_items() as $item) {
      $qty = max(1, (int) $item->get_quantity());
      $unit = $qty ? ((float) $item->get_total() / $qty) : 0;
      $diff = abs(round($unit, 2) - round($voucher_value, 2));
      if ($best === null || $diff < $best_diff) {
        $best = $item;
        $best_diff = $diff;
      }
    }
    if ($best !== null) return $best;
  }
  return null;
}
}
