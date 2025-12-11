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

  wp_enqueue_style('vms-admin-css', VMS_ADMIN_URL.'assets/css/admin.css', [], VMS_ADMIN_VERSION);
  wp_enqueue_script('vms-admin-js', VMS_ADMIN_URL.'assets/js/admin.js', ['jquery'], VMS_ADMIN_VERSION, true);

  wp_localize_script('vms-admin-js', 'VMSAdmin', [
    'ajax'  => admin_url('admin-ajax.php'),
    'nonce' => wp_create_nonce('vms_admin_nonce'),
    'base'  => admin_url('admin.php'),
  ]);
}

}
