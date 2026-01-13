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
    const OPT_PDF_LOGO = 'vms_pdf_logo_url';
    const OPT_PDF_NAME = 'vms_pdf_brand_name';
    const OPT_PDF_LC_TITLE = 'vms_pdf_lc_title';
    const OPT_PDF_LC_TEXT = 'vms_pdf_lc_text';
    const OPT_PDF_CC_TITLE = 'vms_pdf_cc_title';
    const OPT_PDF_CC_TEXT = 'vms_pdf_cc_text';
    const OPT_PDF_RC_TITLE = 'vms_pdf_rc_title';
    const OPT_PDF_RC_TEXT = 'vms_pdf_rc_text';
    const OPT_PDF_QR = 'vms_pdf_qr_url';
    const OPT_PDF_BARCODE = 'vms_pdf_barcode_url';
    const OPT_PDF_HELP_TITLE = 'vms_pdf_help_title';
    const OPT_PDF_HELP_TEXT = 'vms_pdf_help_text';
    const OPT_PDF_WEEKDAYS = 'vms_pdf_weekdays';
    const OPT_EMAIL_SEND = 'vms_send_voucher_email';


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
        register_setting('vms_admin', self::OPT_PDF_LOGO, ['type'=>'string','sanitize_callback'=>'esc_url_raw']);
        register_setting('vms_admin', self::OPT_PDF_NAME, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']);
        register_setting('vms_admin', self::OPT_PDF_LC_TITLE, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']);
        register_setting('vms_admin', self::OPT_PDF_LC_TEXT, ['type'=>'string','sanitize_callback'=>'sanitize_textarea_field']);
        register_setting('vms_admin', self::OPT_PDF_CC_TITLE, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']);
        register_setting('vms_admin', self::OPT_PDF_CC_TEXT, ['type'=>'string','sanitize_callback'=>'sanitize_textarea_field']);
        register_setting('vms_admin', self::OPT_PDF_RC_TITLE, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']);
        register_setting('vms_admin', self::OPT_PDF_RC_TEXT, ['type'=>'string','sanitize_callback'=>'sanitize_textarea_field']);
        register_setting('vms_admin', self::OPT_PDF_QR, ['type'=>'string','sanitize_callback'=>'esc_url_raw']);
        register_setting('vms_admin', self::OPT_PDF_BARCODE, ['type'=>'string','sanitize_callback'=>'esc_url_raw']);
        register_setting('vms_admin', self::OPT_PDF_HELP_TITLE, ['type'=>'string','sanitize_callback'=>'sanitize_text_field']);
        register_setting('vms_admin', self::OPT_PDF_HELP_TEXT, ['type'=>'string','sanitize_callback'=>'sanitize_textarea_field']);
        register_setting('vms_admin', self::OPT_PDF_WEEKDAYS, ['type'=>'string','sanitize_callback'=>'sanitize_textarea_field']);
        register_setting('vms_admin', self::OPT_EMAIL_SEND, ['type'=>'boolean','sanitize_callback'=>'absint']);
    
        add_settings_section('vms_admin_main', __('VMS Settings','vms-admin'), function(){
          echo '<p>'.esc_html__('Configure API and voucher behavior.','vms-admin').'</p>';
        }, 'vms_admin');
    
        add_settings_field(self::OPT_API_URL, __('API URL','vms-admin'), [__CLASS__,'field_api_url'], 'vms_admin', 'vms_admin_main');
        add_settings_field(self::OPT_API_EMAIL, __('API Email (service user)','vms-admin'), [__CLASS__,'field_api_email'], 'vms_admin', 'vms_admin_main');     // NEW
        add_settings_field(self::OPT_API_PASSWORD, __('API Password','vms-admin'), [__CLASS__,'field_api_password'], 'vms_admin', 'vms_admin_main');          // NEW
        add_settings_field(self::OPT_API_TOKEN, __('API Token (optional PAT)','vms-admin'), [__CLASS__,'field_api_token'], 'vms_admin', 'vms_admin_main');    // optional fallback
        add_settings_field(self::OPT_CAT_ID, __('Voucher Category','vms-admin'), [__CLASS__,'field_cat'], 'vms_admin', 'vms_admin_main');
        add_settings_field(self::OPT_MULTIPLIER, __('Amount Multiplier','vms-admin'), [__CLASS__,'field_mult'], 'vms_admin', 'vms_admin_main');
        add_settings_field(self::OPT_EMAIL_SEND, __('Send Voucher Emails','vms-admin'), [__CLASS__,'field_email_send'], 'vms_admin', 'vms_admin_main');

        add_settings_section('vms_admin_pdf', __('Voucher PDF Template','vms-admin'), function(){
          echo '<p>'.esc_html__('Configure voucher PDF template fields.','vms-admin').'</p>';
        }, 'vms_admin');
        add_settings_field(self::OPT_PDF_LOGO, __('PDF Logo URL','vms-admin'), [__CLASS__,'field_pdf_logo'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_NAME, __('PDF Brand Name','vms-admin'), [__CLASS__,'field_pdf_name'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_LC_TITLE, __('Left Column Title','vms-admin'), [__CLASS__,'field_pdf_lc_title'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_LC_TEXT, __('Left Column Text','vms-admin'), [__CLASS__,'field_pdf_lc_text'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_CC_TITLE, __('Center Column Title','vms-admin'), [__CLASS__,'field_pdf_cc_title'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_CC_TEXT, __('Center Column Text','vms-admin'), [__CLASS__,'field_pdf_cc_text'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_RC_TITLE, __('Right Column Title','vms-admin'), [__CLASS__,'field_pdf_rc_title'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_RC_TEXT, __('Right Column Text','vms-admin'), [__CLASS__,'field_pdf_rc_text'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_QR, __('QR Code Image','vms-admin'), [__CLASS__,'field_pdf_qr'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_BARCODE, __('Barcode Image','vms-admin'), [__CLASS__,'field_pdf_barcode'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_HELP_TITLE, __('Help Title','vms-admin'), [__CLASS__,'field_pdf_help_title'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_HELP_TEXT, __('Help Text','vms-admin'), [__CLASS__,'field_pdf_help_text'], 'vms_admin', 'vms_admin_pdf');
        add_settings_field(self::OPT_PDF_WEEKDAYS, __('Weekdays Text','vms-admin'), [__CLASS__,'field_pdf_weekdays'], 'vms_admin', 'vms_admin_pdf');
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
            'taxonomy' => 'product_cat',
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
    public static function field_email_send()
    {
        $v = (int) get_option(self::OPT_EMAIL_SEND, 0);
        echo '<label><input type="checkbox" name="' . self::OPT_EMAIL_SEND . '" value="1" ' . checked(1, $v, false) . ' /> ';
        echo esc_html__('Attach voucher PDFs to customer emails (processing/completed).', 'vms-admin');
        echo '</label>';
    }
    public static function field_pdf_logo()
    {
        $v = esc_url(get_option(self::OPT_PDF_LOGO, ''));
        echo '<input type="url" id="vms-pdf-logo" name="' . self::OPT_PDF_LOGO . '" value="' . esc_attr($v) . '" class="regular-text" placeholder="https://example.com/logo.png" />';
        echo '<button type="button" class="button vms-media-upload" data-target="#vms-pdf-logo">Select</button>';
        if ($v) echo '<div class="vms-media-preview"><img src="' . esc_url($v) . '" alt="" /></div>';
    }
    public static function field_pdf_name()
    {
        $v = esc_attr(get_option(self::OPT_PDF_NAME, ''));
        echo '<input type="text" name="' . self::OPT_PDF_NAME . '" value="' . $v . '" class="regular-text" placeholder="Hair Bar NYC" />';
    }
    public static function field_pdf_lc_title()
    {
        $v = esc_attr(get_option(self::OPT_PDF_LC_TITLE, ''));
        echo '<input type="text" name="' . self::OPT_PDF_LC_TITLE . '" value="' . $v . '" class="regular-text" />';
    }
    public static function field_pdf_lc_text()
    {
        $v = get_option(self::OPT_PDF_LC_TEXT, '');
        wp_editor($v, 'vms_pdf_lc_text', [
          'textarea_name' => self::OPT_PDF_LC_TEXT,
          'textarea_rows' => 5,
          'media_buttons' => false,
        ]);
    }
    public static function field_pdf_cc_title()
    {
        $v = esc_attr(get_option(self::OPT_PDF_CC_TITLE, ''));
        echo '<input type="text" name="' . self::OPT_PDF_CC_TITLE . '" value="' . $v . '" class="regular-text" />';
    }
    public static function field_pdf_cc_text()
    {
        $v = get_option(self::OPT_PDF_CC_TEXT, '');
        wp_editor($v, 'vms_pdf_cc_text', [
          'textarea_name' => self::OPT_PDF_CC_TEXT,
          'textarea_rows' => 5,
          'media_buttons' => false,
        ]);
    }
    public static function field_pdf_rc_title()
    {
        $v = esc_attr(get_option(self::OPT_PDF_RC_TITLE, ''));
        echo '<input type="text" name="' . self::OPT_PDF_RC_TITLE . '" value="' . $v . '" class="regular-text" />';
    }
    public static function field_pdf_rc_text()
    {
        $v = get_option(self::OPT_PDF_RC_TEXT, '');
        wp_editor($v, 'vms_pdf_rc_text', [
          'textarea_name' => self::OPT_PDF_RC_TEXT,
          'textarea_rows' => 5,
          'media_buttons' => false,
        ]);
    }
    public static function field_pdf_qr()
    {
        $v = esc_url(get_option(self::OPT_PDF_QR, ''));
        echo '<input type="url" id="vms-pdf-qr" name="' . self::OPT_PDF_QR . '" value="' . esc_attr($v) . '" class="regular-text" placeholder="https://example.com/qr.png" />';
        echo '<button type="button" class="button vms-media-upload" data-target="#vms-pdf-qr">Select</button>';
        if ($v) echo '<div class="vms-media-preview"><img src="' . esc_url($v) . '" alt="" /></div>';
    }
    public static function field_pdf_barcode()
    {
        $v = esc_url(get_option(self::OPT_PDF_BARCODE, ''));
        echo '<input type="url" id="vms-pdf-barcode" name="' . self::OPT_PDF_BARCODE . '" value="' . esc_attr($v) . '" class="regular-text" placeholder="https://example.com/barcode.png" />';
        echo '<button type="button" class="button vms-media-upload" data-target="#vms-pdf-barcode">Select</button>';
        if ($v) echo '<div class="vms-media-preview"><img src="' . esc_url($v) . '" alt="" /></div>';
    }
    public static function field_pdf_help_title()
    {
        $v = esc_attr(get_option(self::OPT_PDF_HELP_TITLE, ''));
        echo '<input type="text" name="' . self::OPT_PDF_HELP_TITLE . '" value="' . $v . '" class="regular-text" />';
    }
    public static function field_pdf_help_text()
    {
        $v = get_option(self::OPT_PDF_HELP_TEXT, '');
        wp_editor($v, 'vms_pdf_help_text', [
          'textarea_name' => self::OPT_PDF_HELP_TEXT,
          'textarea_rows' => 5,
          'media_buttons' => false,
        ]);
    }
    public static function field_pdf_weekdays()
    {
        $v = esc_attr(get_option(self::OPT_PDF_WEEKDAYS, ''));
        echo '<input type="text" name="' . self::OPT_PDF_WEEKDAYS . '" value="' . $v . '" class="regular-text" />';
    }
}
