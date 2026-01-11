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
add_action('wp_ajax_vms_sync_vouchers', [__CLASS__,'sync_vouchers']);
add_action('wp_ajax_vms_sync_salons', [__CLASS__,'sync_salons']);
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

public static function sync_vouchers(){
  self::check_nonce();
  $offset = isset($_POST['offset']) ? absint($_POST['offset']) : 0;
  $limit = isset($_POST['limit']) ? absint($_POST['limit']) : 25;
  if ($limit <= 0) $limit = 25;
  if ($limit > 100) $limit = 100;

  $query = new \WP_Query([
    'post_type' => 'voucher',
    'post_status' => 'publish',
    'posts_per_page' => $limit,
    'offset' => $offset,
    'orderby' => 'ID',
    'order' => 'ASC',
    'fields' => 'ids',
  ]);

  $total = (int) $query->found_posts;
  $created = 0;
  $updated = 0;
  $code_updated = 0;
  $skipped = 0;
  $errors = [];

  $salon_map = self::get_salon_map();
  $vms_salons = self::fetch_vms_salons();

  foreach ($query->posts as $post_id) {
    $code = sanitize_text_field(get_post_meta($post_id, '_voucher_id', true));
    if (!$code) {
      $skipped++;
      continue;
    }

    $payload = self::build_legacy_payload($post_id, $salon_map, $vms_salons);
    if (is_wp_error($payload)) {
      $errors[] = "Payload failed for {$code}: ".$payload->get_error_message();
      $skipped++;
      continue;
    }

    $res = API::request('POST', 'vouchers/sync', $payload);
    if (is_wp_error($res)) {
      $errors[] = "Sync failed for {$code}";
      $skipped++;
      continue;
    }

    if (!empty($res['created'])) $created++;
    if (!empty($res['updated'])) $updated++;
    if (!empty($res['codeUpdated'])) $code_updated++;
  }

  self::set_salon_map($salon_map);

  $processed = count($query->posts);
  $next_offset = $offset + $processed;
  $done = $next_offset >= $total || $processed === 0;

  if (count($errors) > 5) $errors = array_slice($errors, 0, 5);

  wp_send_json_success([
    'done' => $done,
    'next_offset' => $next_offset,
    'total' => $total,
    'processed' => $processed,
    'created' => $created,
    'updated' => $updated,
    'code_updated' => $code_updated,
    'skipped' => $skipped,
    'errors' => $errors,
  ]);
}

public static function sync_salons(){
  self::check_nonce();
  $created = 0;
  $updated = 0;
  $skipped = 0;
  $errors = [];

  $salon_posts = get_posts([
    'post_type' => 'salon',
    'posts_per_page' => -1,
    'orderby' => 'ID',
    'order' => 'ASC',
    'fields' => 'ids',
  ]);

  $map = self::get_salon_map();
  $vms_salons = self::fetch_vms_salons();
  $lookup = self::build_salon_lookup($vms_salons);

  foreach ($salon_posts as $sid) {
    $name = get_the_title($sid);
    if (!$name) {
      $skipped++;
      continue;
    }
    $key = strtolower($name);
    if (isset($map[$sid]) && (int) $map[$sid] > 0) {
      $skipped++;
      continue;
    }
    if (isset($lookup[$key])) {
      $map[$sid] = (int) $lookup[$key]['id'];
      $updated++;
      continue;
    }

    $created_res = API::request('POST', 'salons', ['name' => $name]);
    if (is_wp_error($created_res) || empty($created_res['id'])) {
      $errors[] = "Salon create failed for {$name}";
      $skipped++;
      continue;
    }
    $map[$sid] = (int) $created_res['id'];
    $created++;
    $lookup[$key] = ['id' => (int) $created_res['id'], 'name' => $name];
  }

  self::set_salon_map($map);

  wp_send_json_success([
    'created' => $created,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
  ]);
}

protected static function normalize_legacy_status($status){
  $raw = strtolower(trim((string) $status));
  if ($raw === '' || $raw === 'active' || $raw === 'available') return 'AVAILABLE';
  if (in_array($raw, ['redeemed', 'used'], true)) return 'REDEEMED';
  if (in_array($raw, ['void', 'voided', 'canceled', 'cancelled', 'refunded', 'failed'], true)) return 'VOID';
  return 'AVAILABLE';
}

protected static function build_legacy_payload($post_id, &$salon_map = [], &$vms_salons = []){
  $code = sanitize_text_field(get_post_meta($post_id, '_voucher_id', true));
  if (!$code) return new \WP_Error('vms_sync_missing_code', 'Missing voucher code');

  $order_id = absint(get_post_meta($post_id, '_order_id', true));
  $order_number = sanitize_text_field(get_post_meta($post_id, '_order_number', true));
  $product_id = get_post_meta($post_id, '_product_id', true);
  $product_id = $product_id !== '' ? (string) $product_id : '';
  $product_name = sanitize_text_field(get_post_meta($post_id, '_product_name', true));
  $amount = (float) get_post_meta($post_id, '_amount', true);
  $currency = 'CAD';
  $customer_name = sanitize_text_field(get_post_meta($post_id, '_customer_name', true));
  $customer_email = sanitize_email(get_post_meta($post_id, '_customer_email', true));
  $phone = '';
  $legacy_status = get_post_meta($post_id, '_selected_status', true);
  if (!$legacy_status) $legacy_status = get_post_meta($post_id, '_prev_selected_status', true);
  $target_status = self::normalize_legacy_status($legacy_status);
  $is_redeem = get_post_meta($post_id, '_is_redeem', true);
  $redeem_flag = $is_redeem === '1' || $is_redeem === 1 || $is_redeem === true;
  if (!$redeem_flag) {
    $redeem_flag = (bool) get_post_meta($post_id, '_date-redeem', true);
  }
  if ($redeem_flag) $target_status = 'REDEEMED';
  [$first_name, $last_name] = self::split_customer_name($customer_name);

  if ($order_id && class_exists('WooCommerce') && function_exists('wc_get_order')) {
    $order = wc_get_order($order_id);
    if ($order) {
      $order_number = $order->get_order_number() ?: $order_number;
      $currency = $order->get_currency() ?: $currency;
      $phone = sanitize_text_field($order->get_billing_phone());
      if (!$customer_email) $customer_email = $order->get_billing_email();
      if (!$first_name && !$last_name) {
        $first_name = $order->get_billing_first_name();
        $last_name = $order->get_billing_last_name();
      }

      $item = null;
      foreach ($order->get_items() as $order_item) {
        if ($product_id && (int) $order_item->get_product_id() === (int) $product_id) {
          $item = $order_item;
          break;
        }
        if ($item === null) $item = $order_item;
      }

      if ($item) {
        if (!$product_name) $product_name = $item->get_name();
        if (!$product_id) $product_id = (string) $item->get_product_id();
        if ($amount <= 0) {
          $qty = max(1, (int) $item->get_quantity());
          $unit_total = $qty > 0 ? ((float) $item->get_total() / $qty) : (float) $item->get_total();
          $amount = $unit_total;
        }
      }
    }
  }

  $multiplier = (float) get_option(Settings::OPT_MULTIPLIER, '1.0');
  if ($multiplier <= 0) $multiplier = 1.0;
  $value = round($amount * $multiplier, 2);

  $site_url = home_url();
  $site_host = wp_parse_url($site_url, PHP_URL_HOST);
  $source_label = $site_host ? $site_host : $site_url;
  $external_id = $order_id ? sprintf('%s:%s', $source_label, $order_id) : 'legacy:'.$post_id;
  $order_id_str = $order_number ?: ($order_id ? (string) $order_id : (string) $post_id);
  $title = $product_name ?: 'Legacy Voucher';

  $payload = [
    'code' => $code,
    'title' => $title,
    'source' => $site_url,
    'order_external_id' => $external_id,
    'order_id' => (string) $order_id_str,
    'order_total' => $value,
    'order_products' => [[
      'product_id' => $product_id,
      'product_name' => $product_name ?: $title,
      'product_price' => $value,
    ]],
    'face_value' => $value,
    'currency' => $currency,
    'customer' => [
      'email' => $customer_email,
      'phone' => $phone,
      'first_name' => $first_name,
      'last_name' => $last_name,
    ],
    'status' => $target_status,
  ];

  $expires_raw = sanitize_text_field(get_post_meta($post_id, '_voucher_exp_date', true));
  $expires_at = self::normalize_date($expires_raw);
  if ($expires_at) $payload['expires_at'] = $expires_at;

  if ($target_status === 'REDEEMED') {
    $redeemed_raw = get_post_meta($post_id, '_redeemed_date', true);
    if (!$redeemed_raw) $redeemed_raw = get_post_meta($post_id, '_date-redeem', true);
    if (!$redeemed_raw) {
      $log = get_post_meta($post_id, '_voucher_action_log', true);
      $redeemed_raw = self::extract_redeem_date_from_log($log);
    }
    $redeemed_at = self::normalize_datetime($redeemed_raw);
    if ($redeemed_at) $payload['redeemed_at'] = $redeemed_at;

    $sel_raw = get_post_meta($post_id, '_selected_salon', true);
    if (!$sel_raw) {
      $log = get_post_meta($post_id, '_voucher_action_log', true);
      $sel_raw = self::extract_redeem_salon_from_log($log);
    }
    $salon_id = self::resolve_vms_salon_id($sel_raw, $salon_map, $vms_salons);
    if ($salon_id) $payload['redeemed_salon_id'] = $salon_id;
  }

  return $payload;
}

protected static function get_salon_map(){
  $map = get_option('vms_salon_map', []);
  return is_array($map) ? $map : [];
}

protected static function set_salon_map($map){
  update_option('vms_salon_map', is_array($map) ? $map : []);
}

protected static function fetch_vms_salons(){
  $salons = API::salons();
  if (is_wp_error($salons)) return [];
  if (is_array($salons) && array_key_exists('data', $salons)) return is_array($salons['data']) ? $salons['data'] : [];
  return is_array($salons) ? $salons : [];
}

protected static function build_salon_lookup($salons){
  $lookup = [];
  foreach ($salons as $salon) {
    if (!is_array($salon) || empty($salon['name']) || empty($salon['id'])) continue;
    $lookup[strtolower($salon['name'])] = $salon;
  }
  return $lookup;
}

protected static function resolve_vms_salon_id($sel_raw, &$map, &$vms_salons){
  if ($sel_raw === '' || $sel_raw === null) return 0;
  if (is_string($sel_raw) && in_array($sel_raw, ['Redeem','NONE'], true)) return 0;
  $lookup = self::build_salon_lookup($vms_salons);

  if (is_numeric($sel_raw)) {
    $mapped_wp = self::map_legacy_salon_id((int) $sel_raw);
    if (isset($map[$mapped_wp])) return (int) $map[$mapped_wp];
    $name = get_the_title((int) $mapped_wp);
    if ($name) {
      $key = strtolower($name);
      if (isset($lookup[$key])) {
        $map[$mapped_wp] = (int) $lookup[$key]['id'];
        return (int) $lookup[$key]['id'];
      }
      $created = API::request('POST', 'salons', ['name' => $name]);
      if (!is_wp_error($created) && !empty($created['id'])) {
        $map[$mapped_wp] = (int) $created['id'];
        $vms_salons[] = ['id' => (int) $created['id'], 'name' => $name];
        return (int) $created['id'];
      }
    }
    return 0;
  }

  $name = sanitize_text_field($sel_raw);
  if ($name === '') return 0;
  $key = strtolower($name);
  if (isset($lookup[$key])) return (int) $lookup[$key]['id'];
  $created = API::request('POST', 'salons', ['name' => $name]);
  if (!is_wp_error($created) && !empty($created['id'])) {
    $vms_salons[] = ['id' => (int) $created['id'], 'name' => $name];
    return (int) $created['id'];
  }
  return 0;
}

protected static function map_legacy_salon_id($val){
  $map = [46796=>2365,43028=>2364,43027=>2363,8817=>2362,8816=>2361,8813=>2360,8812=>2359,7896=>2358,7895=>2357];
  if (is_numeric($val)) {
    $ival = (int) $val;
    return $map[$ival] ?? $ival;
  }
  return $val;
}

protected static function extract_redeem_date_from_log($log){
  if (empty($log)) return '';
  $entries = is_array($log) ? $log : [$log];
  foreach ($entries as $entry) {
    if (!is_string($entry)) continue;
    if (preg_match('/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/', $entry, $m)) return $m[1];
    if (preg_match('/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/', $entry, $m)) return $m[1];
  }
  return '';
}

protected static function extract_redeem_salon_from_log($log){
  if (empty($log)) return '';
  $entries = is_array($log) ? $log : [$log];
  foreach ($entries as $entry) {
    if (!is_string($entry)) continue;
    if (preg_match('/<strong>\s*([^<]+)\s*<\/strong>/i', $entry, $m)) {
      return wp_strip_all_tags($m[1]);
    }
  }
  return '';
}

protected static function normalize_datetime($raw){
  $raw = trim((string) $raw);
  if ($raw === '') return '';
  $ts = strtotime($raw);
  if ($ts) return gmdate('Y-m-d H:i:s', $ts);
  return '';
}

protected static function split_customer_name($name){
  $clean = preg_replace('/\s+/', ' ', trim((string) $name));
  if ($clean === '') return ['', ''];
  $parts = explode(' ', $clean);
  $first = array_shift($parts);
  $last = implode(' ', $parts);
  return [$first, $last];
}

protected static function normalize_date($raw){
  $raw = trim((string) $raw);
  if ($raw === '') return '';
  $dt = \DateTime::createFromFormat('m/d/Y', $raw);
  if ($dt instanceof \DateTime) return $dt->format('Y-m-d');
  $ts = strtotime($raw);
  if ($ts) return gmdate('Y-m-d', $ts);
  return '';
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
