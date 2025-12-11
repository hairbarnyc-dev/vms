<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
<h1>VMS — Settings</h1>
<form method="post" action="options.php">
<?php settings_fields('vms_admin'); do_settings_sections('vms_admin'); submit_button(); ?>
<p class="description">
  If <strong>API Token</strong> is blank, the plugin will log in automatically using
  <strong>API Email</strong> &amp; <strong>Password</strong> and cache a JWT.
</p>
</form>
</div>