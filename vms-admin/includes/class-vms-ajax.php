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
'status' => isset($_POST['status']) ?
sanitize_text_field($_POST['status']) : '',
'salon_id' => isset($_POST['salon_id']) ? absint($_POST['salon_id']) : '',
'q' => isset($_POST['q']) ? sanitize_text_field($_POST['q']) : '',
'date_from' => isset($_POST['date_from']) ?
sanitize_text_field($_POST['date_from']) : '',
'date_to' => isset($_POST['date_to']) ?
sanitize_text_field($_POST['date_to']) : '',
];
$data = API::vouchers(array_filter($query, fn($v)=>$v!=='' && $v!==null));
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
wp_send_json_success($data);
}
public static function fetch_voucher_details(){
self::check_nonce();
$code = isset($_POST['code']) ? sanitize_text_field($_POST['code']) : '';
if (!$code) wp_send_json_error('missing code', 400);
$data = API::voucherByCode($code);
if (is_wp_error($data)) wp_send_json_error($data->get_error_data(), 400);
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
}