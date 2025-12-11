<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
  <h1>VMS — Salons</h1>
  <table class="widefat fixed striped" id="vms-salons-table">
    <thead>
      <tr><th>Name</th><th>Email</th><th>City</th><th>Region</th><th>Active</th></tr>
    </thead>
    <tbody id="vms-salons-tbody">
      <tr><td colspan="5"><em>Loading salons…</em></td></tr>
    </tbody>
  </table>
</div>
<?php
wp_enqueue_script('vms-salons-js', VMS_ADMIN_URL.'assets/js/salons.js?t='.time(), ['vms-admin-js'], VMS_ADMIN_VERSION, true);
