(function ($) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code") || "";
  if (!code) {
    jQuery("#vms-voucher").html("<p>Missing code.</p>");
    return;
  }
  async function fetchDetails() {
    const res = await $.post(VMSAdmin.ajax, {
      action: "vms_fetch_voucher_details",
      nonce: VMSAdmin.nonce,
      code,
    });
    if (!res || !res.success) throw new Error("Failed to load");
    return res.data;
  }
  function render(v) {
    const order = v.order || null
    const customer = v.customer || {}
    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
      v.customer_name ||
      "-"
    const customerEmail = customer.email || v.customer_email || "-"
    const formatDate = (value) => {
      if (!value) return ""
      const d = new Date(value)
      return isNaN(d.getTime()) ? String(value) : d.toLocaleString()
    }
    let statusClass = "vms-status-active"
    const status = String(v.status || "").toUpperCase()
    if (status === "REDEEMED") statusClass = "vms-status-used"
    if (status === "VOID") statusClass = "vms-status-canceled"
    const wp = v.wp || {}
    const orderNumber = wp.order_number || (order && (order.order_id || order.external_id)) || v.order_id || "-"
    const orderSource = (order && order.source) || v.source || "-"
    const actionLog =
      status === "REDEEMED"
        ? "<li>Voucher redeemed.</li>"
        : status === "VOID"
        ? "<li>Voucher voided.</li>"
        : "<li>Voucher not used.</li>"
    const rows = `
      <div class="vms-metabox">
        <div class="vms-metabox__title">Vouchers &amp; Account Information</div>
        <div class="vms-metabox__body vms-voucher-grid">
          <div class="vms-voucher-left">
            <div class="vms-voucher-head">
              <div>
            <div class="vms-voucher-title">Voucher # ${v.code || ""}</div>
            <div class="vms-voucher-order">Order # ${orderNumber}</div>
              </div>
              <div class="vms-voucher-status ${statusClass}">${v.status || ""}</div>
            </div>
            <div class="vms-field">
              <label>Voucher Date:</label>
              <div class="vms-field-value">${formatDate(v.created_at) || "-"}</div>
            </div>
            <div class="vms-field vms-field-nobg">
              <label>Expiration Date:</label>
              <div class="vms-field-value">${formatDate(v.expires_at) || "-"}</div>
            </div>
            <div class="vms-field">
              <label>Voucher Status</label>
              <div class="vms-field-value">${v.status || "-"}</div>
            </div>
            <div class="vms-field vms-field-nobg vms-code-block">
              <label>Barcode:</label>
              <div class="vms-field-value vms-barcode-wrap">
                <svg id="vms-barcode"></svg>
                <div class="vms-code-text" style="display: none;">${v.code || ""}</div>
              </div>
            </div>
            <div class="vms-field vms-field-nobg vms-code-block" style="display:none;">
              <label>QR Code:</label>
              <div class="vms-field-value vms-qr-wrap">
                <div id="vms-qr"></div>
              </div>
            </div>
          </div>
          <div class="vms-voucher-right">
          <div class="vms-voucher-title">Account information</div>
          <div class="vms-field">
            <span>Customer Name</span>
            <span>${wp.customer_name || customerName}</span>
          </div>
          <div class="vms-field vms-field-nobg">
            <span>Customer Email</span>
            <span>${wp.customer_email || customerEmail}</span>
          </div>
            <div class="vms-field">
              <span>Voucher not used.</span>
              <ul class="vms-action-log">${actionLog}</ul>
            </div>
          </div>
        </div>
      </div>
    `
    let orderHtml = ""
    let productHtml = ""
    if (order) {
      const products = Array.isArray(order.products) ? order.products : []
      const firstProduct = products[0] || {}
      const unitPrice = Number(v.face_value || wp.product_price || firstProduct.product_price || 0)
      const productName = v.title || wp.product_name || firstProduct.product_name || "-"
      const productSku = wp.product_sku || firstProduct.product_id || "-"
      const productDesc = wp.product_description || ""
      const productImg = wp.product_image || ""
      productHtml = `
        <div class="vms-metabox">
          <div class="vms-metabox__title">Product Information</div>
          <div class="vms-metabox__body">
            <table class="widefat fixed striped vms-product-table">
              <thead><tr><th>Item</th><th>Value</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    ${productImg ? `<img class="vms-product-image" src="${productImg}" alt="" />` : ""}
                    <div class="vms-product-name"><strong>${productName}</strong></div>
                    <div class="vms-product-sku">SKU: ${productSku}</div>
                    ${productDesc ? `<div class="vms-product-desc">${productDesc}</div>` : ""}
                    <div class="vms-product-addons"><em>No add-ons selected</em></div>
                  </td>
                  <td class="vms-product-price">${unitPrice.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <div class="vms-actions-slot" id="vms-actions-slot"></div>
          </div>
        </div>
      `
      const productRows = products.length
        ? products
            .map((p) => {
              const qty = Number(p.quantity || 1);
              const unit = Number(p.product_price || 0);
              const total = unit * qty;
              return `<tr>
                <td>${p.product_name || ""}</td>
                <td>${p.product_id || "-"}</td>
                <td>${qty}</td>
                <td>${unit.toFixed(2)}</td>
                <td>Any selected add-ons</td>
                <td>${total.toFixed(2)}</td>
              </tr>`;
            })
            .join("")
        : `<tr><td colspan="6"><em>No products recorded.</em></td></tr>`
      orderHtml = `
        <div class="vms-metabox">
          <div class="vms-metabox__title">Order Details</div>
          <div class="vms-metabox__body">
            <table class="widefat fixed striped vms-order-table">
              <thead>
                <tr><th>Product</th><th>Model</th><th>Quantity</th><th>Unit Price</th><th>Add-ons</th><th>Total</th></tr>
              </thead>
              <tbody>${productRows}</tbody>
              <tfoot>
                <tr class="vms-order-total">
                  <td colspan="5">Subtotal</td>
                  <td>${Number(order.subtotal || order.order_total || order.amount || 0).toFixed(2)}</td>
                </tr>
                <tr class="vms-order-total">
                  <td colspan="5">Grand Total</td>
                  <td>${Number(order.order_total || order.amount || 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `
    }
    jQuery("#vms-voucher").html(rows + productHtml + orderHtml);
    const actions = jQuery("#vms-actions");
    if (actions.length) {
      jQuery("#vms-actions-slot").append(actions);
    }
    // QR & Barcode
    try {
      const qrTarget = document.getElementById("vms-qr");
      if (qrTarget) {
        const qrUrl = (VMSAdmin.pdf && VMSAdmin.pdf.qr) || "";
        if (qrUrl) {
          const img = document.createElement("img");
          img.src = qrUrl;
          img.alt = "QR";
          qrTarget.appendChild(img);
        } else {
          new QRCode(qrTarget, {
            text: v.code,
            width: 128,
            height: 128,
          });
        }
      }
    } catch (e) {}
    try {
      JsBarcode("#vms-barcode", v.code, {
        format: "CODE128",
        width: 3,
        height: 80,
        displayValue: false,
      });
    } catch (e) {}
  }
  async function redeemFlow() {
    // fetch salons list
    const res = await $.post(VMSAdmin.ajax, {
      action: "vms_fetch_salons",
      nonce: VMSAdmin.nonce,
    });
    const salons = res && res.success ? res.data : [];
    const options = salons
      .map(
        (s) => `<option value="${s.id}">${s.name}</
option>`
      )
      .join("");
    VMSModal.open(
      "Redeem Voucher",
      `<table class="form-table" role="presentation">
  <tbody>
    <tr>
      <th scope="row"><label>Code</label></th>
      <td><strong>${code}</strong></td>
    </tr>

    <tr>
      <th scope="row"><label for="vms-redeem-salon">Salon</label></th>
      <td>
        <select id="vms-redeem-salon">${options}</select>
      </td>
    </tr>

    <tr>
      <th scope="row"><label for="vms-redeem-notes">Notes</label></th>
      <td>
        <input id="vms-redeem-notes" type="text" class="regular-text" />
      </td>
    </tr>
  </tbody>
</table>`,
      `<button class="button button-primary" id="vms-go">Redeem</button>
<button class="button" id="vms-c">Cancel</button>`
    );
    jQuery("#vms-c").on("click", () => VMSModal.close());
    jQuery("#vms-go").on("click", async () => {
      const salonId = jQuery("#vms-redeem-salon").val();
      const notes = jQuery("#vms-redeem-notes").val();
      const resp = await $.post(VMSAdmin.ajax, {
        action: "vms_redeem_voucher",
        nonce: VMSAdmin.nonce,
        code,
        salon_id: salonId,
        notes,
      });
      if (resp && resp.success) {
        alert("Redeemed");
        VMSModal.close();
        location.reload();
      } else {
        alert("Error redeeming");
      }
    });
  }
  async function voidFlow() {
    VMSModal.open(
      "Void Voucher",
      `<p>Code: <strong>${code}</strong></
p><label>Reason/Notes <input id="vms-void-notes" class="regular-text" /></
label>`,
      `<button class="button button-primary" id="vms-go">Void</button>
<button class="button" id="vms-c">Cancel</button>`
    );
    jQuery("#vms-c").on("click", () => VMSModal.close());
    jQuery("#vms-go").on("click", async () => {
      const notes = jQuery("#vms-void-notes").val();
      const resp = await $.post(VMSAdmin.ajax, {
        action: "vms_void_voucher",
        nonce: VMSAdmin.nonce,
        code,
        notes,
      });
      if (resp && resp.success) {
        alert("Voided");
        VMSModal.close();
        location.reload();
      } else {
        alert("Error voiding");
      }
    });
  }
  function pdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return alert("PDF engine missing");

    const ensureHtml2Canvas = () =>
      new Promise((resolve, reject) => {
        if (window.html2canvas) return resolve();
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("html2canvas load failed"));
        document.head.appendChild(script);
      });

    const svg = document.getElementById("vms-barcode");
    const qr = document.querySelector("#vms-qr canvas");
    const barcodeData = svg
      ? "data:image/svg+xml;base64," +
        window.btoa(
          unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg)))
        )
      : "";
    const qrData = qr ? qr.toDataURL("image/png") : "";
    const v = window.__vmsVoucher || {};
    const wp = v.wp || {};
    const map = {
      order_number: wp.order_number || (v.order && v.order.order_id) || v.order_id || "",
      voucher_number: v.code || "",
      LOGO: (VMSAdmin.pdf && VMSAdmin.pdf.logo) || "",
      NAME: (VMSAdmin.pdf && VMSAdmin.pdf.name) || "",
      product_name: wp.product_name || "",
      product_sku: wp.product_sku || "",
      product_description: wp.product_description || "",
      ADDONS: "No add-ons selected",
      customer_name: wp.customer_name || "",
      customer_email: wp.customer_email || "",
      expiry_date: v.expires_at ? new Date(v.expires_at).toISOString().slice(0, 10) : "",
      product_price: v.face_value ? `$${Number(v.face_value).toFixed(2)}` : "",
      product_image: wp.product_image || "",
      barcode: barcodeData,
      LC_TITLE: (VMSAdmin.pdf && VMSAdmin.pdf.lc_title) || "",
      LC_TEXT: (VMSAdmin.pdf && VMSAdmin.pdf.lc_text) || "",
      CC_TITLE: (VMSAdmin.pdf && VMSAdmin.pdf.cc_title) || "",
      CC_TEXT: (VMSAdmin.pdf && VMSAdmin.pdf.cc_text) || "",
      RC_TEXT: (VMSAdmin.pdf && VMSAdmin.pdf.rc_text) || "",
      RC_TITLE: (VMSAdmin.pdf && VMSAdmin.pdf.rc_title) || "",
      HELP_TITLE: (VMSAdmin.pdf && VMSAdmin.pdf.help_title) || "",
      HELP_TEXT: (VMSAdmin.pdf && VMSAdmin.pdf.help_text) || "",
      WEEKDAYS: (VMSAdmin.pdf && VMSAdmin.pdf.weekdays) || "",
      QR: (VMSAdmin.pdf && VMSAdmin.pdf.qr) || qrData,
      FONT_BASE: (VMSAdmin.assets || "") + "assets/fonts/"
    };
    const pagePadding = 36;
    const pageWidthPx = 850;
    const pageHeightPx = 1096;
    const contentWidthPx = pageWidthPx - pagePadding * 2;
    const contentHeightPx = pageHeightPx - pagePadding * 2;
    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Voucher</title>
  <style>@page { size: letter portrait; margin: 14px; }</style>
  <style>
    @font-face{font-family:'FuturaPT';src:url('{{FONT_BASE}}FuturaPT-Light.ttf') format('truetype');font-weight:300;font-style:normal;}
    @font-face{font-family:'FuturaPT';src:url('{{FONT_BASE}}FuturaPT-Book.ttf') format('truetype');font-weight:400;font-style:normal;}
    @font-face{font-family:'FuturaPT';src:url('{{FONT_BASE}}FuturaPT-Demi.ttf') format('truetype');font-weight:600;font-style:normal;}
    html, body, * { font-family:'FuturaPT','DejaVu Sans',sans-serif !important; font-weight:400; }
    .ff1 { font-weight:600 !important; }
    .ff2 { font-weight:400 !important; }
    .ff3 { font-weight:600 !important; }
    .ff4 { font-weight:300 !important; }
  </style>
  <style>
    body { margin:0; padding:0; -webkit-print-color-adjust:exact; font-size:12.5pt; line-height:1.35; }
    html { margin:0; }
    *, *:after, *:before { box-sizing:border-box; }
    img { display:block; max-width:100%; }
    .page { padding:${pagePadding}px; width:900px; background:#fff; }
    .voucher-template, .voucher-head, .voucher-coupon, .voucher-notes-cols { page-break-inside: avoid; }
    .voucher-template { overflow:hidden; display:block; width:100%; margin:0; background:#fff; box-shadow:none; }
    .voucher-head { display:table; width:100%; margin-bottom:20px; position:relative; }
    .voucher-head__info, .voucher-head__logo, .voucher-head__name { display:table-cell; vertical-align:middle; }
    .voucher-head__logo { text-align:center; }
    .voucher-head__info, .voucher-head__name { width:180px; }
    .voucher-head__name { text-align:right; font-size:15px; }
    .voucher-head__logo img { max-width:220px; margin:0 auto; }
    .inf-row { font-size:14px; line-height:14px; font-weight:bold; }
    .voucher-coupon { margin-bottom:14px; }
    .voucher-coupon__inner { display:table; width:100%; }
    .voucher-coupon__body { width: calc(100% - 102px); }
    .voucher-coupon__body-inner { background:#F2F2F2; padding:18px; border-radius:10px; display:table; width:100%; box-sizing: border-box; }
    .voucher-coupon__body, .voucher-coupon__code { display:table-cell; vertical-align:top; }
    .voucher-coupon__code { background:#F2F2F2; padding:8px; border-radius:10px !important; overflow: hidden; width:200px; border-left:2px dashed #fff; position:relative; vertical-align:middle; }
    .voucher__title { color:#252323; font-size:20px; line-height:1.25; margin-bottom:8px; white-space:normal; overflow:visible; }
    .voucher__sku, .voucher__addons { font-size:12px; margin-bottom:7px; }
    .voucher__descr { margin-bottom:10px; color:#56595A; font-size:14px; }
    .voucher-coupon__info { width: calc(100% - 142px - 36px); margin-right: 10px; padding-right:0; display:table-cell; vertical-align:top; }
    .voucher-coupon__info > div { min-height:auto; }
    .voucher-coupon__img { display:table-cell; text-align:right; }
    .voucher-coupon__image { width:180px; min-width:180px; display:inline-block; text-align:right; }
    .voucher__contacts { margin-top:8px; }
    .voucher__contacts .for, .voucher__contacts .email { font-size:14px; line-height:18px; }
    .use { color:#30B6CA; font-size:14px; margin:4px 0; }
    .value { font-size:14px; }
    .voucher-coupon__code-inner { background:#fff; border-radius:10px; padding:6px 4px 6px 4px; height:200px; display:flex; flex-direction:column; justify-content:center; align-items:center; width: 150px; margin-left: 5px; }
    .barcode-img { height:140px; width:auto; max-height:none; transform:rotate(-90deg); transform-origin:center; }
    .barcode-human { font-size:11px; line-height:1; text-align:center; word-break: break-all; overflow-wrap: anywhere; margin-top:6px; }
    .voucher-notes-cols { display:table; }
    .voucher-notes-cols-wrap { width: calc(100% - 196px); padding-right:12px; display:table-cell; }
    .voucher-notes-cols-group { margin-bottom:6px; display:table; width:100%; }
    .voucher-notes-cols-group > .col { display:table-cell; width:33%; }
    .voucher-notes-cols-group > .col:nth-child(1) { padding-right:12px; }
    .col-title { font-size:18px; margin-bottom:10px; display:block; font-weight:bold; }
    .col p { font-size:14px; margin:0; color:#252323; line-height: 15px; }
    .col p + p { margin-top:6px; }
    .col p a { color:#30B6CA; }
    .col-qr { background:#F2F2F2; padding:10px; border-radius:10px; display:table-cell; width:196px; }
    .col-qr p { font-size:14px; line-height:15px; color:#252323; }
    .col-qr p strong { font-weight:bold; color:#000; }
    .qr { margin-top:20px; width:98px; }
    .voucher-footer { display:table; vertical-align:bottom; padding-top:6px; border-top:1px solid #d4f9ff; margin-top:0; width:100% !important; }
    .help { display:table-cell; width:136px; }
    .help strong { font-size:14px; display:block; margin-bottom:3px; }
    .help p { font-size:14px; margin:0; line-height:15px; }
    .help p a { color:#30B6CA; }
    .time { line-height:1.2; font-size:14px; padding-left:56px; display:table-cell; margin-top:auto; vertical-align:bottom; text-align:left; }
  </style>
</head>
<body>
  <div id="page-container">
    <div class="page">
    <div class="voucher-template">
      <div class="voucher-head">
        <div class="voucher-head__info">
          <div class="inf-row ff3"><strong>ORDER NUMBER: </strong><span class="ff2">#{{order_number}}</span></div>
          <div class="inf-row ff3"><strong>VOUCHER CODE: </strong><span class="ff2">{{voucher_number}}</span></div>
          <div class="inf-row ff3"><strong>REF: </strong><span class="ff2">8575882</span></div>
        </div>
        <div class="voucher-head__logo"><img style="max-width: 300px;" src="{{LOGO}}" alt="#"></div>
        <div class="voucher-head__name ff2">{{NAME}}</div>
      </div>
      <div class="voucher-coupon" style="border-radius: 10px; overflow: hidden;">
        <div class="voucher-coupon__inner" style="border-radius: 10px; overflow: hidden;">
          <div class="voucher-coupon__body">
            <div class="voucher-coupon__body-inner">
              <div class="voucher-coupon__info">
                <div>
                  <div class="voucher__title ff1">{{product_name}}</div>
                  <div class="voucher__sku ff4">SKU: {{product_sku}}</div>
                  <div class="voucher__descr ff2" style="line-height: 1rem;">{{product_description}}</div>
                  <div class="voucher__addons ff4">{{ADDONS}}</div>
                  <div class="voucher__contacts">
                    <div class="for ff2">For: {{customer_name}}</div>
                    <div class="email ff2">Email: {{customer_email}}</div>
                    <div class="use ff2">Use this voucher by {{expiry_date}}</div>
                    <div class="value ff2">Voucher value: {{product_price}}</div>
                  </div>
                </div>
              </div>
              <div class="voucher-coupon__img">
                <img class="voucher-coupon__image" src="{{product_image}}" alt="#" style="margin-top: 20px;">
              </div>
            </div>
          </div>
          <div class="voucher-coupon__code">
            <div class="voucher-coupon__code-inner">
              <img class="barcode-img" src="{{barcode}}" alt="Barcode" />
            </div>
          </div>
        </div>
      </div>
      <div class="voucher-notes-cols">
        <div class="voucher-notes-cols-wrap">
          <div class="voucher-notes-cols-group">
            <div class="col">
              <span class="col-title ff3">{{LC_TITLE}}</span>
              <p style="padding-right:20px; letter-spacing:0;">{{LC_TEXT}}</p>
            </div>
            <div class="col" style="margin-right: 10px !important; width: 34% !important;">
              <span class="col-title ff3">{{CC_TITLE}}</span>
              <p style="padding-right:20px !important; letter-spacing:0;">{{CC_TEXT}}</p>
            </div>
            <div class="col col-qr">
              <p class="col-title ff3" style="padding-right:20px; letter-spacing:0;"><strong>{{RC_TITLE}}</strong><br>{{RC_TEXT}}</p>
              <div class="qr">
                <img src="{{QR}}" alt="#">
              </div>
            </div>
          </div>
          <div class="voucher-footer" style="padding-bottom: 20px;">
            <div class="help">
              <strong>{{HELP_TITLE}}</strong>
              <p style="padding-right:20px; letter-spacing:0;">{{HELP_TEXT}}</p>
            </div>
            <div class="time">{{WEEKDAYS}}</div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</body>
</html>
    `;
    const filled = template.replace(/\{\{(\w+)\}\}/g, (m, key) =>
      map[key] !== undefined ? String(map[key]) : ""
    );

    ensureHtml2Canvas()
      .then(async () => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(filled, "text/html");
        const styles = Array.from(doc.querySelectorAll("style"))
          .map((s) => s.textContent)
          .join("\n");
        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.width = `${pageWidthPx}px`;
        wrapper.style.overflow = "visible";
        wrapper.style.background = "#fff";
        wrapper.style.pointerEvents = "none";
        wrapper.style.zIndex = "-1";
        wrapper.innerHTML = `<style>${styles}</style>${doc.body.innerHTML}`;
        document.body.appendChild(wrapper);

        const imgs = Array.from(wrapper.querySelectorAll("img"));
        await Promise.all(
          imgs.map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) return resolve();
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
          )
        );

        if (document.fonts && document.fonts.ready) {
          try {
            await document.fonts.ready;
          } catch (e) {}
        }
        const canvas = await window.html2canvas(wrapper, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#fff",
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "letter");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pad = pagePadding;
        const targetW = pageWidth - pad * 2;
        const targetH = pageHeight - pad * 2;
        const scale = Math.min(targetW / imgWidth, targetH / imgHeight) * 0.95;
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const offsetX = pad;
        const offsetY = pad;
        pdf.addImage(imgData, "PNG", offsetX, offsetY, drawWidth, drawHeight);
        pdf.save(`voucher-${code}.pdf`);
        document.body.removeChild(wrapper);
      })
      .catch(() => alert("Failed to generate PDF"));
  }
  jQuery(async function () {
    try {
      const v = await fetchDetails();
      window.__vmsVoucher = v;
      render(v);
    } catch (e) {
      jQuery("#vms-voucher").html("<p>Error</p>");
    }
    jQuery("#vms-btn-redeem").on("click", redeemFlow);
    jQuery("#vms-btn-void").on("click", voidFlow);
    jQuery("#vms-btn-pdf").on("click", pdf);
  });
})(jQuery);
