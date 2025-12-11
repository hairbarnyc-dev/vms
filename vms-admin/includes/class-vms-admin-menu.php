<?php
namespace VMS_Admin;


if ( ! defined('ABSPATH') ) { exit; }


class Admin_Menu {
public static function init(){
add_action('admin_menu', [__CLASS__, 'menu']);
}


public static function menu(){
$cap = 'manage_options';


add_menu_page(
__('VMS','vms-admin'), __('VMS','vms-admin'), $cap, 'vms-admin', [__CLASS__,'render_settings'], 'dashicons-tickets-alt', 58
);


add_submenu_page('vms-admin', __('Settings','vms-admin'), __('Settings','vms-admin'), $cap, 'vms-admin', [__CLASS__,'render_settings']);
add_submenu_page('vms-admin', __('Salons','vms-admin'), __('Salons','vms-admin'), $cap, 'vms-admin-salons', [__CLASS__,'render_salons']);
add_submenu_page('vms-admin', __('Vouchers','vms-admin'), __('Vouchers','vms-admin'), $cap, 'vms-admin-vouchers', [__CLASS__,'render_vouchers']);


// Hidden details page
add_submenu_page(null, __('Voucher Details','vms-admin'), __('Voucher Details','vms-admin'), $cap, 'vms-admin-voucher-details', [__CLASS__,'render_voucher_details']);
}


public static function render_settings(){
include VMS_ADMIN_PATH.'includes/views/page-settings.php';
}
public static function render_salons(){
include VMS_ADMIN_PATH.'includes/views/page-salons.php';
}
public static function render_vouchers(){
include VMS_ADMIN_PATH.'includes/views/page-vouchers.php';
}
public static function render_voucher_details(){
include VMS_ADMIN_PATH.'includes/views/page-voucher-details.php';
}
}