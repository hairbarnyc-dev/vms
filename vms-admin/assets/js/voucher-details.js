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
    const rows = `
 <table class="widefat fixed striped">
 <tbody>
 <tr><th>Code</th><td>${v.code}</td></tr>
 <tr><th>Title</th><td>${v.title || ""}</td></tr>
 <tr><th>Status</th><td>${v.status || ""}</td></tr>
 <tr><th>Salon</th><td>${v.salon_name || "-"}</td></tr>
 <tr><th>Face Value</th><td>${v.face_value || ""} ${v.currency || ""}</
td></tr>
 <tr><th>Created</th><td>${
   v.created_at ? new Date(v.created_at).toLocaleString() : ""
 }</td></tr>
 <tr><th>Expires</th><td>${v.expires_at || ""}</td></tr>
 <tr><th>Notes</th><td>${v.notes || ""}</td></tr>
 </tbody>
 </table>`;
    let orderHtml = ""
    if (order) {
      const products = Array.isArray(order.products) ? order.products : []
      const productRows = products.length
        ? products
            .map(
              (p) => `<tr>
                <td>${p.product_name || ""}</td>
                <td>${p.product_id || "-"}</td>
                <td>${Number(p.product_price || 0).toFixed(2)}</td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="3"><em>No products recorded.</em></td></tr>`
      orderHtml = `
        <h3>Order Information</h3>
        <table class="widefat fixed striped">
          <tbody>
            <tr><th>Order Number</th><td>${order.order_id || "-"}</td></tr>
            <tr><th>External ID</th><td>${order.external_id || "-"}</td></tr>
            <tr><th>Total</th><td>${Number(order.order_total || order.amount || 0).toFixed(2)} ${order.currency || ""}</td></tr>
            <tr><th>Created</th><td>${order.created_at ? new Date(order.created_at).toLocaleString() : "-"}</td></tr>
          </tbody>
        </table>
        <h4>Products</h4>
        <table class="widefat fixed striped">
          <thead><tr><th>Name</th><th>ID</th><th>Price</th></tr></thead>
          <tbody>${productRows}</tbody>
        </table>
      `
    }
    jQuery("#vms-voucher").html(rows + orderHtml);
    // QR & Barcode
    try {
      new QRCode(document.getElementById("vms-qr"), {
        text: v.code,
        width: 128,
        height: 128,
      });
    } catch (e) {}
    try {
      JsBarcode("#vms-barcode", v.code, {
        format: "CODE128",
        width: 2,
        height: 48,
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
      `<p>Code: <strong>${code}</strong></
p><label>Salon <select id="vms-redeem-salon">${options}</select></
label><label>Notes <input id="vms-redeem-notes" class="regular-text" /></
label>`,
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
    // jsPDF UMD
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return alert("PDF engine missing");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Voucher", 14, 16);
    doc.setFontSize(10);
    doc.text("Code: " + code, 14, 26);
    // Add QR (rasterize existing)
    const qr = document.querySelector("#vms-qr canvas");
    if (qr) doc.addImage(qr.toDataURL("image/png"), "PNG", 14, 32, 40, 40);
    // Add barcode (SVG to PNG via canvas)
    const svg = document.getElementById("vms-barcode");
    if (svg) {
      const xml = new XMLSerializer().serializeToString(svg);
      const svg64 = window.btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        doc.addImage(c.toDataURL("image/png"), "PNG", 60, 32, 130, 30);
        doc.save("voucher-" + code + ".pdf");
      };
      img.src = "data:image/svg+xml;base64," + svg64;
    } else {
      doc.save("voucher-" + code + ".pdf");
    }
  }
  jQuery(async function () {
    try {
      const v = await fetchDetails();
      render(v);
    } catch (e) {
      jQuery("#vmsvoucher").html("<p>Error</p>");
    }
    jQuery("#vms-btn-redeem").on("click", redeemFlow);
    jQuery("#vms-btn-void").on("click", voidFlow);
    jQuery("#vms-btn-pdf").on("click", pdf);
  });
})(jQuery);
