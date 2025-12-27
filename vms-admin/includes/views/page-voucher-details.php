<?php if ( ! defined('ABSPATH') ) exit; ?>
<div class="wrap vms-admin-wrap">
<h1>VMS — Voucher Details</h1>
<div id="vms-voucher"></div>
<div class="vms-actions" id="vms-actions">
<button class="button" id="vms-btn-redeem">Redeem…</button>
<button class="button" id="vms-btn-void">Void…</button>
<button class="button button-primary" id="vms-btn-pdf">Download PDF</button>
</div>
</div>
<div id="vms-modal" class="vms-modal" hidden>
<div class="vms-modal__dialog">
<div class="vms-modal__header"><strong id="vms-modal-title"></strong><button type="button" class="button-link vms-modal__close">×</button></div>
<div class="vms-modal__body" id="vms-modal-body"></div>
<div class="vms-modal__footer" id="vms-modal-footer"></div>
</div>
</div>
<?php
wp_enqueue_script('vms-qrcode', VMS_ADMIN_URL.'assets/vendor/qrcode.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-jsbarcode', VMS_ADMIN_URL.'assets/vendor/jsbarcode.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-jspdf', VMS_ADMIN_URL.'assets/vendor/jspdf.umd.min.js', [], VMS_ADMIN_VERSION, true);
wp_enqueue_script('vms-voucher-details', VMS_ADMIN_URL.'assets/js/voucher-details.js', ['vms-admin-js','vms-qrcode','vms-jsbarcode','vms-jspdf'], VMS_ADMIN_VERSION, true);
