<?php
namespace VMS_Admin;


if (!defined('ABSPATH')) {
    exit;
}


class Settings
{
    const OPT_API_URL = 'vms_api_url';
    const OPT_API_TOKEN = 'vms_api_token';      // keep for PATs if you ever want it
    const OPT_API_EMAIL = 'vms_api_email';      // NEW
    const OPT_API_PASSWORD = 'vms_api_password';   // NEW
    const OPT_CAT_ID = 'vms_voucher_category';
    const OPT_MULTIPLIER = 'vms_amount_multiplier';


    public static function init()
    {
        add_action('admin_init', [__CLASS__, 'register']);
    }


   public static function register(){
        register_setting('vms_admin', self::OPT_API_URL, ['type'=>'string','sanitize_callback'=>'esc_url_raw']);
        register_setting('vms_admin', self::OPT_API_TOKEN, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']); // optional
        register_setting('vms_admin', self::OPT_API_EMAIL, ['type'=>'string','sanitize_callback'=>'sanitize_email']);      // NEW
        register_setting('vms_admin', self::OPT_API_PASSWORD, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']); // NEW
        register_setting('vms_admin', self::OPT_CAT_ID, ['type'=>'integer','sanitize_callback'=>'absint']);
        register_setting('vms_admin', self::OPT_MULTIPLIER, [
          'type'=>'string',
          'sanitize_callback'=> function($val){ $f = floatval($val); return number_format($f, 1, '.', ''); }
        ]);
    
        add_settings_section('vms_admin_main', __('VMS Settings','vms-admin'), function(){
          echo '<p>'.esc_html__('Configure API and voucher behavior.','vms-admin').'</p>';
        }, 'vms_admin');
    
        add_settings_field(self::OPT_API_URL, __('API URL','vms-admin'), [__CLASS__,'field_api_url'], 'vms_admin', 'vms_admin_main');
        add_settings_field(self::OPT_API_EMAIL, __('API Email (service user)','vms-admin'), [__CLASS__,'field_api_email'], 'vms_admin', 'vms_admin_main');     // NEW
        add_settings_field(self::OPT_API_PASSWORD, __('API Password','vms-admin'), [__CLASS__,'field_api_password'], 'vms_admin', 'vms_admin_main');          // NEW
        add_settings_field(self::OPT_API_TOKEN, __('API Token (optional PAT)','vms-admin'), [__CLASS__,'field_api_token'], 'vms_admin', 'vms_admin_main');    // optional fallback
        add_settings_field(self::OPT_CAT_ID, __('Voucher Category','vms-admin'), [__CLASS__,'field_cat'], 'vms_admin', 'vms_admin_main');
        add_settings_field(self::OPT_MULTIPLIER, __('Amount Multiplier','vms-admin'), [__CLASS__,'field_mult'], 'vms_admin', 'vms_admin_main');
      }
    
      public static function field_api_email(){
        $v = esc_attr(get_option(self::OPT_API_EMAIL, ''));
        echo '<input type="email" name="'.self::OPT_API_EMAIL.'" value="'.$v.'" class="regular-text" placeholder="service@vms.local" autocomplete="off" />';
      }
      public static function field_api_password(){
        $v = esc_attr(get_option(self::OPT_API_PASSWORD, ''));
        echo '<input type="password" name="'.self::OPT_API_PASSWORD.'" value="'.$v.'" class="regular-text" placeholder="••••••••" autocomplete="new-password" />';
        echo '<p class="description">'.esc_html__('Stored in WordPress options; use a dedicated low-privilege service user.','vms-admin').'</p>';
      }


    public static function field_api_url()
    {
        $v = esc_url(get_option(self::OPT_API_URL, ''));
        echo '<input type="url" name="' . self::OPT_API_URL . '" value="' . esc_attr($v) . '" class="regular-text" placeholder="http://localhost:4000/api/v1" />';
    }
    public static function field_api_token()
    {
        $v = esc_attr(get_option(self::OPT_API_TOKEN, ''));
        echo '<input type="password" name="' . self::OPT_API_TOKEN . '" value="' . $v . '" class="regular-text" placeholder="Bearer token" />';
    }
    public static function field_cat()
    {
        $sel = (int) get_option(self::OPT_CAT_ID, 0);
        wp_dropdown_categories([
            'show_option_none' => __('— Select —', 'vms-admin'),
            'taxonomy' => 'category',
            'name' => self::OPT_CAT_ID,
            'selected' => $sel,
            'hide_empty' => false
        ]);
    }
    public static function field_mult()
    {
        $v = esc_attr(get_option(self::OPT_MULTIPLIER, '1.0'));
        echo '<input type="number" step="0.1" min="0.1" name="' . self::OPT_MULTIPLIER . '" value="' . $v . '" />';
    }
}