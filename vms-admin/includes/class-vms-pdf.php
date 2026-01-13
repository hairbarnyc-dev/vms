<?php
namespace VMS_Admin;

if ( ! defined('ABSPATH') ) { exit; }

use Dompdf\Dompdf;

class PDF {
  const FILE_DIR = 'vms-vouchers';

  protected static function ensure_dompdf(){
    if (class_exists('Dompdf\\Dompdf')) return true;
    $paths = [
      VMS_ADMIN_PATH . 'vendor/autoload.php',
      $_SERVER['DOCUMENT_ROOT'] . '/lib/dompdf/autoload.inc.php',
      $_SERVER['DOCUMENT_ROOT'] . '/lib/vendor/autoload.php',
    ];
    foreach ($paths as $path) {
      if (file_exists($path)) {
        require_once $path;
        if (class_exists('Dompdf\\Dompdf')) return true;
      }
    }
    return false;
  }

  protected static function template_html(){
    $path = VMS_ADMIN_PATH . 'includes/templates/voucher-pdf.html';
    if (!file_exists($path)) return '';
    return file_get_contents($path);
  }

  protected static function get_upload_dir(){
    $uploads = wp_upload_dir();
    $dir = trailingslashit($uploads['basedir']) . self::FILE_DIR;
    if (!is_dir($dir)) wp_mkdir_p($dir);
    return $dir;
  }

  protected static function get_upload_url(){
    $uploads = wp_upload_dir();
    return trailingslashit($uploads['baseurl']) . self::FILE_DIR;
  }

  protected static function barcode_data_uri($code){
    if (class_exists('Picqer\\Barcode\\BarcodeGeneratorPNG')) {
      try {
        $gen = new \Picqer\Barcode\BarcodeGeneratorPNG();
        $png = $gen->getBarcode($code, $gen::TYPE_CODE_128, 2, 70);
        return 'data:image/png;base64,' . base64_encode($png);
      } catch (\Throwable $e) {
        return '';
      }
    }
    return '';
  }

  protected static function build_map($data){
    $v = $data;
    $wp = isset($v['wp']) && is_array($v['wp']) ? $v['wp'] : [];
    $order = isset($v['order']) && is_array($v['order']) ? $v['order'] : [];
    $customer = isset($v['customer']) && is_array($v['customer']) ? $v['customer'] : [];

    $order_number = $wp['order_number'] ?? ($order['order_id'] ?? ($v['order_id'] ?? ''));
    $expiry = !empty($v['expires_at']) ? gmdate('Y-m-d', strtotime($v['expires_at'])) : '';
    $price = isset($v['face_value']) ? '$' . number_format((float) $v['face_value'], 2) : '';

    $font_base = rtrim(str_replace('\\', '/', realpath(VMS_ADMIN_PATH . 'assets/fonts/')), '/');
    $font_base = $font_base ? 'file://' . $font_base . '/' : '';

    $customer_name = trim((($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')));
    if (!$customer_name) $customer_name = $wp['customer_name'] ?? '';
    $customer_email = $customer['email'] ?? ($wp['customer_email'] ?? '');

    return [
      'order_number' => $order_number,
      'voucher_number' => $v['code'] ?? '',
      'LOGO' => esc_url(get_option(Settings::OPT_PDF_LOGO, '')),
      'NAME' => sanitize_text_field(get_option(Settings::OPT_PDF_NAME, '')),
      'product_name' => $wp['product_name'] ?? ($v['title'] ?? ''),
      'product_sku' => $wp['product_sku'] ?? '',
      'product_description' => $wp['product_description'] ?? '',
      'ADDONS' => 'No add-ons selected',
      'customer_name' => $customer_name,
      'customer_email' => $customer_email,
      'expiry_date' => $expiry,
      'product_price' => $price,
      'product_image' => $wp['product_image'] ?? '',
      'barcode' => self::barcode_data_uri($v['code'] ?? ''),
      'LC_TITLE' => sanitize_text_field(get_option(Settings::OPT_PDF_LC_TITLE, '')),
      'LC_TEXT' => wp_kses_post(get_option(Settings::OPT_PDF_LC_TEXT, '')),
      'CC_TITLE' => sanitize_text_field(get_option(Settings::OPT_PDF_CC_TITLE, '')),
      'CC_TEXT' => wp_kses_post(get_option(Settings::OPT_PDF_CC_TEXT, '')),
      'RC_TEXT' => wp_kses_post(get_option(Settings::OPT_PDF_RC_TEXT, '')),
      'RC_TITLE' => sanitize_text_field(get_option(Settings::OPT_PDF_RC_TITLE, '')),
      'HELP_TITLE' => sanitize_text_field(get_option(Settings::OPT_PDF_HELP_TITLE, '')),
      'HELP_TEXT' => wp_kses_post(get_option(Settings::OPT_PDF_HELP_TEXT, '')),
      'WEEKDAYS' => wp_kses_post(get_option(Settings::OPT_PDF_WEEKDAYS, '')),
      'QR' => esc_url(get_option(Settings::OPT_PDF_QR, '')),
      'FONT_BASE' => $font_base,
    ];
  }

  protected static function render_html($data){
    $tpl = self::template_html();
    if (!$tpl) return '';
    $map = self::build_map($data);
    return preg_replace_callback('/\{\{(\w+)\}\}/', function($m) use ($map){
      $key = $m[1];
      return isset($map[$key]) ? (string) $map[$key] : '';
    }, $tpl);
  }

  public static function generate_pdf_for_code($code, $force = false){
    if (!self::ensure_dompdf()) return new \WP_Error('vms_pdf_missing', 'Dompdf is not available');
    $code = trim((string) $code);
    if (!$code) return new \WP_Error('vms_pdf_missing_code', 'Missing code');

    $dir = self::get_upload_dir();
    $file = trailingslashit($dir) . 'voucher-' . sanitize_file_name($code) . '.pdf';
    if (!$force && file_exists($file)) return $file;

    $data = API::voucherByCode($code);
    if (is_wp_error($data)) return $data;
    $data = Ajax::augment_with_wc_order($data);

    $html = self::render_html($data);
    if (!$html) return new \WP_Error('vms_pdf_template', 'Missing PDF template');

    $dompdf = new Dompdf();
    $dompdf->set_option('isRemoteEnabled', true);
    $dompdf->loadHtml($html);
    $dompdf->setPaper('letter', 'portrait');
    $dompdf->render();
    $output = $dompdf->output();
    file_put_contents($file, $output);
    return $file;
  }

  public static function stream_pdf($code){
    $file = self::generate_pdf_for_code($code);
    if (is_wp_error($file)) {
      wp_die($file->get_error_message());
    }
    if (!file_exists($file)) wp_die('File not found');
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="'.basename($file).'"');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
  }
}
