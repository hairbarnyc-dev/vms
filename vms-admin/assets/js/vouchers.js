(function ($) {
  async function fetchSalons() {
    const res = await $.post(VMSAdmin.ajax, {
      action: "vms_fetch_salons",
      nonce: VMSAdmin.nonce,
    });
    return res && res.success ? res.data : [];
  }
  async function fetchVouchers(payload) {
    const res = await $.post(
      VMSAdmin.ajax,
      Object.assign(
        {
          action: "vms_fetch_vouchers",
          nonce: VMSAdmin.nonce,
          page: 1,
          pageSize: 100,
        },
        payload
      )
    );
    if (!res || !res.success) throw new Error("Failed to load vouchers");
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.items)) return res.data.items;
    if (res.data && Array.isArray(res.data.rows)) return res.data.rows;
    return [];
  }
  function renderRows(items) {
    if (!Array.isArray(items) || !items.length)
      return '<tr><td colspan="11"><em>No vouchers found.</em></td></tr>';
    return items
      .map((v) => {
        const wp = v.wp || {};
        const orderNumber =
          wp.order_number || v.order_number || v.order_external_id || v.order_id || "-";
        const orderLink = wp.order_id
          ? `${VMSAdmin.base}?post=${encodeURIComponent(wp.order_id)}&action=edit`
          : "";
        const serviceName = wp.product_name || v.title || "-";
        const voucherValue = wp.product_price || v.face_value || "0.00";
        const grandTotal = wp.grand_total || v.order_total || v.face_value || "0.00";
        const customerName = wp.customer_name || v.customer_name || "-";
        const customerEmail = wp.customer_email || v.customer_email || "";
        const customerLink = wp.customer_link || "";
        const voucherDate = v.created_at
          ? new Date(v.created_at).toLocaleDateString()
          : "";
        const expDate = v.expires_at
          ? new Date(v.expires_at).toLocaleDateString()
          : "";
        const isRedeemed = String(v.status || "").toUpperCase() === "REDEEMED";
        const redeemedAt = v.redeemed_at
          ? new Date(v.redeemed_at).toLocaleDateString()
          : "";
        const redeemedSalon = v.redeemed_salon_name || v.salon_name || "-";
        const redeemedCell = isRedeemed
          ? (redeemedAt ? `${redeemedSalon}<br>${redeemedAt}` : redeemedSalon)
          : "—";
        const actions = `
 <button class="button vms-act-redeem" data-code="${v.code}">Redeem</button>
 <button class="button vms-act-void" data-code="${v.code}">Void</button>
 `;
        return `<tr>
          <td><a href="${VMSAdmin.base}?page=vms-admin-voucher-details&code=${encodeURIComponent(v.code)}">${v.code}</a></td>
          <td>${orderLink ? `<a href="${orderLink}">${orderNumber}</a>` : orderNumber}</td>
          <td>${serviceName}</td>
          <td>${voucherValue}</td>
          <td>${grandTotal}</td>
          <td>${customerLink ? `<a href="${customerLink}">${customerName}</a>` : customerName}${
            customerEmail ? `<br><a href="mailto:${customerEmail}">${customerEmail}</a>` : ""
          }</td>
          <td>${voucherDate}</td>
          <td>${expDate}</td>
          <td>${v.status || ""}</td>
          <td>${redeemedCell}</td>
          <td>${actions}</td>
        </tr>`;
      })
      .join("");
  }
  function redeemModal(code, salons) {
    const options = salons
      .map(
        (s) => `<option value="${s.id}">${s.name}</
option>`
      )
      .join("");
    VMSModal.open(
      "Redeem Voucher",
      `
 <div>
 <table class="form-table" role="presentation">
 <tbody>
 <tr>
  <th scope="row"><label for="blogname">Code</label></th>
  <td>${code}</td>
 </tr>
 <tr>
  <th scope="row"><label for="blogname">Salon</label></th>
  <td><select id="vms-redeem-salon">${options}</select></td>
 </tr>
 <tr>
  <th scope="row"><label for="blogname">Notes</label></th>
  <td><input id="vms-redeem-notes" type="text" class="regular-text"  /></td>
 </tr>
 </tbody></table>
 </div>
 `,
      `
 <button class="button button-primary" id="vms-redeem-go">Redeem</button>
 <button class="button" id="vms-redeem-cancel">Cancel</button>
 `
    );
    jQuery("#vms-redeem-cancel").on("click", () => VMSModal.close());
    jQuery("#vms-redeem-go").on("click", async () => {
      const salonId = jQuery("#vms-redeem-salon").val();
      const notes = jQuery("#vms-redeem-notes").val();
      const res = await $.post(VMSAdmin.ajax, {
        action: "vms_redeem_voucher",
        nonce: VMSAdmin.nonce,
        code: code,
        salon_id: salonId,
        notes: notes,
      });
      if (res && res.success) {
        alert("Redeemed");
        VMSModal.close();
        jQuery("#vms-filters").trigger("submit");
      } else {
        alert("Error redeeming");
      }
    });
  }
  function voidModal(code) {
    VMSModal.open(
      "Void Voucher",
      `
 <div>
 <p><strong>Code:</strong> ${code}</p>
 <label>Reason/Notes
 <input id="vms-void-notes" class="regular-text" />
 </label>
 </div>
 `,
      `
 <button class="button button-primary" id="vms-void-go">Void</button>
 <button class="button" id="vms-void-cancel">Cancel</button>
 `
    );
    jQuery("#vms-void-cancel").on("click", () => VMSModal.close());
    jQuery("#vms-void-go").on("click", async () => {
      const notes = jQuery("#vms-void-notes").val();
      const res = await $.post(VMSAdmin.ajax, {
        action: "vms_void_voucher",
        nonce: VMSAdmin.nonce,
        code: code,
        notes: notes,
      });
      if (res && res.success) {
        alert("Voided");
        VMSModal.close();
        jQuery("#vms-filters").trigger("submit");
      } else {
        alert("Error voiding");
      }
    });
  }
  jQuery(async function () {
    // populate salon filter
    try {
      const salons = await fetchSalons();
      const $sel = jQuery("#vms-salon-select");
      salons.forEach((s) =>
        $sel.append(`<option value="${s.id}">${s.name}</
option>`)
      );
    } catch (e) {
      console.warn("salons fetch failed");
    }
    // submit filters
    jQuery("#vms-filters").on("submit", async function (e) {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(this).entries());
      try {
        const items = await fetchVouchers(payload);
        jQuery("#vms-vouchers-table tbody").html(renderRows(items));
      } catch (err) {
        jQuery("#vms-vouchers-table tbody").html(
          '<tr><td colspan="9">Error loading vouchers</td></tr>'
        );
      }
    });
    // initial load
    jQuery("#vms-filters").trigger("submit");
    // actions
    jQuery("#vms-vouchers-table").on(
      "click",
      ".vms-act-redeem",
      async function () {
        const code = this.getAttribute("data-code");
        try {
          redeemModal(code, await fetchSalons());
        } catch (e) {
          alert("Failed to load salons");
        }
      }
    );
    jQuery("#vms-vouchers-table").on("click", ".vms-act-void", function () {
      const code = this.getAttribute("data-code");
      voidModal(code);
    });
  });
})(jQuery);
