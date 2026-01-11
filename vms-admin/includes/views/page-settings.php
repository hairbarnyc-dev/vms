<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
<h1>VMS — Settings</h1>
<h2 class="nav-tab-wrapper vms-settings-tabs">
  <a href="#" class="nav-tab nav-tab-active" data-tab="#vms-tab-plugin">Plugin settings</a>
  <a href="#" class="nav-tab" data-tab="#vms-tab-pdf">PDF settings</a>
  <a href="#" class="nav-tab" data-tab="#vms-tab-sync">Sync vouchers</a>
</h2>
<form method="post" action="options.php">
<?php settings_fields('vms_admin'); ?>
<div id="vms-tab-plugin" class="vms-settings-panel">
  <?php
  global $wp_settings_sections, $wp_settings_fields;
  $page = 'vms_admin';
  if (!empty($wp_settings_sections[$page]['vms_admin_main'])) {
    $section = $wp_settings_sections[$page]['vms_admin_main'];
    if ($section['title']) echo '<h2>'.$section['title'].'</h2>';
    if ($section['callback']) call_user_func($section['callback'], $section);
    if (!empty($wp_settings_fields[$page]['vms_admin_main'])) {
      echo '<table class="form-table" role="presentation">';
      do_settings_fields($page, 'vms_admin_main');
      echo '</table>';
    }
  }
  ?>
</div>
<div id="vms-tab-pdf" class="vms-settings-panel" style="display:none;">
  <?php
  if (!empty($wp_settings_sections[$page]['vms_admin_pdf'])) {
    $section = $wp_settings_sections[$page]['vms_admin_pdf'];
    if ($section['title']) echo '<h2>'.$section['title'].'</h2>';
    if ($section['callback']) call_user_func($section['callback'], $section);
    if (!empty($wp_settings_fields[$page]['vms_admin_pdf'])) {
      echo '<table class="form-table" role="presentation">';
      do_settings_fields($page, 'vms_admin_pdf');
      echo '</table>';
    }
  }
  ?>
</div>
<div id="vms-tab-sync" class="vms-settings-panel" style="display:none;" data-ajax="<?php echo esc_url(admin_url('admin-ajax.php')); ?>" data-nonce="<?php echo esc_attr(wp_create_nonce('vms_admin_nonce')); ?>">
  <h2>Sync vouchers</h2>
  <p class="description">
    Sync legacy voucher posts from WordPress into VMS. This checks by voucher code and creates any missing vouchers in batches.
  </p>
  <p>
    <label for="vms-sync-batch"><strong>Batch size</strong></label>
    <input type="number" min="1" max="100" step="1" id="vms-sync-batch" value="25" />
  </p>
  <p>
    <button type="button" class="button button-primary" id="vms-sync-start">Sync vouchers</button>
    <button type="button" class="button" id="vms-sync-stop" disabled>Stop</button>
  </p>
  <div id="vms-sync-status" class="description">Idle.</div>
  <hr />
  <h3>Sync salons</h3>
  <p class="description">
    Sync WordPress salon posts into VMS so redeemed vouchers can link to the correct salon.
  </p>
  <p>
    <button type="button" class="button" id="vms-sync-salons">Sync salons</button>
  </p>
  <div id="vms-sync-salons-status" class="description">Idle.</div>
</div>
<?php submit_button(); ?>
<p class="description">
  If <strong>API Token</strong> is blank, the plugin will log in automatically using
  <strong>API Email</strong> &amp; <strong>Password</strong> and cache a JWT.
</p>
</form>
</div>
