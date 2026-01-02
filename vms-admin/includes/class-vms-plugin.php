<?php
namespace VMS_Admin;


if ( ! defined('ABSPATH') ) { exit; }


class Plugin {
public static function init() {
Admin_Menu::init();
Settings::init();
Ajax::init();
Woo::init();
add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
load_plugin_textdomain('vms-admin', false, dirname(plugin_basename(VMS_ADMIN_PATH.'vms-admin.php')).'/languages');
}


public static function enqueue( $hook ){
  // load only on our plugin pages (settings, salons, vouchers, details)
  $page = isset($_GET['page']) ? sanitize_text_field($_GET['page']) : '';
  if (strpos($page, 'vms-admin') !== 0) return;

  if ($page === 'vms-admin') {
    wp_enqueue_media();
    wp_enqueue_script('vms-admin-settings', VMS_ADMIN_URL.'assets/js/settings.js', ['jquery'], VMS_ADMIN_VERSION, true);
  }

  wp_enqueue_style('vms-admin-css', VMS_ADMIN_URL.'assets/css/admin.css', [], VMS_ADMIN_VERSION);
  wp_enqueue_script('vms-admin-js', VMS_ADMIN_URL.'assets/js/admin.js', ['jquery'], VMS_ADMIN_VERSION, true);

  wp_localize_script('vms-admin-js', 'VMSAdmin', [
    'ajax'  => admin_url('admin-ajax.php'),
    'nonce' => wp_create_nonce('vms_admin_nonce'),
    'base'  => admin_url('admin.php'),
    'assets' => VMS_ADMIN_URL,
    'pdf' => [
      'logo' => esc_url(get_option(Settings::OPT_PDF_LOGO, '')),
      'qr' => esc_url(get_option(Settings::OPT_PDF_QR, '')),
      'barcode' => esc_url(get_option(Settings::OPT_PDF_BARCODE, '')),
      'name' => sanitize_text_field(get_option(Settings::OPT_PDF_NAME, '')),
      'lc_title' => sanitize_text_field(get_option(Settings::OPT_PDF_LC_TITLE, '')),
      'lc_text' => wp_kses_post(get_option(Settings::OPT_PDF_LC_TEXT, '')),
      'cc_title' => sanitize_text_field(get_option(Settings::OPT_PDF_CC_TITLE, '')),
      'cc_text' => wp_kses_post(get_option(Settings::OPT_PDF_CC_TEXT, '')),
      'rc_title' => sanitize_text_field(get_option(Settings::OPT_PDF_RC_TITLE, '')),
      'rc_text' => wp_kses_post(get_option(Settings::OPT_PDF_RC_TEXT, '')),
      'help_title' => sanitize_text_field(get_option(Settings::OPT_PDF_HELP_TITLE, '')),
      'help_text' => wp_kses_post(get_option(Settings::OPT_PDF_HELP_TEXT, '')),
      'weekdays' => wp_kses_post(get_option(Settings::OPT_PDF_WEEKDAYS, '')),
    ],
  ]);
}

}
