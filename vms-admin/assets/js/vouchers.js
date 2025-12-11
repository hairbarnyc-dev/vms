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
        },
        payload
      )
    );
    if (!res || !res.success) throw new Error("Failed to load vouchers");
    return res.data;
  }
  function renderRows(items) {
    if (!Array.isArray(items) || !items.length)
      return '<tr><td colspan="8"><em>No vouchers found.</em></td></tr>';
    return items
      .map((v) => {
        const salonName = v.salon_name || "-";
        const orderSource = v.order_source || (v.order && v.order.source) || "-";
        const orderNumber =
          v.order_number ||
          (v.order && (v.order.order_id || v.order.external_id)) ||
          v.order_external_id ||
          "-";
        const created = v.created_at
          ? new Date(v.created_at).toLocaleString()
          : "";
        const actions = `
 <a class="button" href="${
   VMSAdmin.base
 }?page=vms-admin-voucher-details&code=${encodeURIComponent(v.code)}">Details</a>
 <button class="button vms-act-redeem" data-code="${v.code}">Redeem</
button>
 <button class="button vms-act-void" data-code="${v.code}">Void</button>
 `;
        return `<tr>
          <td>${v.code}</td>
          <td>${v.title || ""}</td>
          <td>${salonName}</td>
          <td>${orderSource}</td>
          <td>${orderNumber}</td>
          <td>${v.status || ""}</td>
          <td>${created}</td>
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
 <p><strong>Code:</strong> ${code}</p>
 <label>Salon
 <select id="vms-redeem-salon">${options}</select>
 </label>
 <label>Notes
 <input id="vms-redeem-notes" class="regular-text" />
 </label>
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
        jQuery("#vmsfilters").trigger("submit");
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
          '<tr><td colspan="6">Error loading vouchers</td></tr>'
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
