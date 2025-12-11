<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
<h1>VMS — Voucher Details</h1>
<div id="vms-voucher"></div>
<div class="vms-actions">
<button class="button" id="vms-btn-redeem">Redeem…</button>
<button class="button" id="vms-btn-void">Void…</button>
<button class="button button-primary" id="vms-btn-pdf">Download PDF</button>
</div>
<div class="vms-codes">
<div>
<h3>QR Code</h3>
<div id="vms-qr"></div>
</div>
<div>
<h3>Barcode</h3>
<svg id="vms-barcode"></svg>
</div>
</div>
</div>
<?php
wp_enqueue_script('vms-qrcode', VMS_ADMIN_URL.'assets/vendor/qrcode.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-jsbarcode', VMS_ADMIN_URL.'assets/vendor/jsbarcode.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-jspdf', VMS_ADMIN_URL.'assets/vendor/jspdf.umd.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-voucher-details', VMS_ADMIN_URL.'assets/js/voucher-details.js', ['vms-admin-js','vms-qrcode','vms-jsbarcode','vms-jspdf'], VMS_ADMIN_VERSION, true);