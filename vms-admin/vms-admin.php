<?php
/**
* Plugin Name: VMS Admin
* Description: Admin UI for VMS — settings, salons, vouchers, voucher details with QR/Barcode & PDF.
* Version: 1.0.0
* Author: EngiNerds
* License: GPLv2 or later
* Text Domain: vms-admin
*/


if ( ! defined('ABSPATH') ) { exit; }


define('VMS_ADMIN_VERSION', '1.0.0');
define('VMS_ADMIN_PATH', plugin_dir_path(__FILE__));
define('VMS_ADMIN_URL', plugin_dir_url(__FILE__));


autoload_vms_admin();
function autoload_vms_admin() {
require_once VMS_ADMIN_PATH . 'includes/class-vms-plugin.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-admin-menu.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-settings.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-api.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-ajax.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-pdf.php';
require_once VMS_ADMIN_PATH . 'includes/class-vms-woo.php';
}


add_action('plugins_loaded', function(){
\VMS_Admin\Plugin::init();
});
