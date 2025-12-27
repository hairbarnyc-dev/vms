<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
<h1>VMS — Vouchers</h1>


<form id="vms-filters" class="vms-filters">
<input type="hidden" name="_wpnonce" value="<?php echo esc_attr(wp_create_nonce('vms_admin_nonce')); ?>" />
<div>
<label>Status
<select name="status">
<option value="">All</option>
<option value="AVAILABLE">AVAILABLE</option>
<option value="REDEEMED">REDEEMED</option>
<option value="VOID">VOID</option>
</select>
</label>
<label>Salon <select name="salon_id" id="vms-salon-select"><option value="">All</option></select></label>
<label>Code/Title <input type="text" name="q" /></label>
<label>From <input type="date" name="date_from" /></label>
<label>To <input type="date" name="date_to" /></label>
<button class="button button-primary" type="submit">Apply</button>
</div>
</form>


<table class="widefat fixed striped" id="vms-vouchers-table">
<thead><tr>
<th>Voucher code</th>
<th>Service name</th>
<th>Grand total</th>
<th>Customer</th>
<th>Voucher date</th>
<th>Expiration date</th>
<th>Status</th>
<th>Redeemed at/on</th>
<th class="column-actions">Actions</th>
</tr></thead>
<tbody><tr><td colspan="9"><em>Use filters to load vouchers…</em></td></tr></tbody>
</table>
</div>


<div id="vms-modal" class="vms-modal" hidden>
<div class="vms-modal__dialog">
<div class="vms-modal__header"><strong id="vms-modal-title"></strong><button type="button" class="button-link vms-modal__close">×</button></div>
<div class="vms-modal__body" id="vms-modal-body"></div>
<div class="vms-modal__footer" id="vms-modal-footer"></div>
</div>
</div>


<?php
wp_enqueue_style('vms-vouchers-css', VMS_ADMIN_URL.'assets/css/vouchers.css', [], VMS_ADMIN_VERSION);
wp_enqueue_script('vms-vouchers-js', VMS_ADMIN_URL.'assets/js/vouchers.js?t='.time(), ['vms-admin-js'], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-salons-js', VMS_ADMIN_URL.'assets/js/salons.js', ['vms-admin-js'], VMS_ADMIN_VERSION, true);
