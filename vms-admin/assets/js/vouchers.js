(function ($) {
  async function fetchSalons() {
    const res = await $.post(VMSAdmin.ajax, {
      action: "vms_fetch_salons",
      nonce: VMSAdmin.nonce,
    });
    return res && res.success ? res.data : [];
  }
  function buildOrderCell(v) {
    const wp = v.wp || {};
    const orderNumber =
      wp.order_number || v.order_number || v.order_external_id || v.order_id || "-";
    const orderLink = wp.order_id
      ? `${VMSAdmin.base}?post=${encodeURIComponent(wp.order_id)}&action=edit`
      : "";
    return orderLink ? `<a href="${orderLink}">${orderNumber}</a>` : orderNumber;
  }
  function buildCustomerCell(v) {
    const wp = v.wp || {};
    const customerName = wp.customer_name || v.customer_name || "-";
    const customerEmail = wp.customer_email || v.customer_email || "";
    const customerLink = wp.customer_link || "";
    const nameHtml = customerLink
      ? `<a href="${customerLink}">${customerName}</a>`
      : customerName;
    const emailHtml = customerEmail
      ? `<br><a href="mailto:${customerEmail}">${customerEmail}</a>`
      : "";
    return `${nameHtml}${emailHtml}`;
  }
  function buildRedeemedCell(v) {
    const isRedeemed = String(v.status || "").toUpperCase() === "REDEEMED";
    const redeemedAt = v.redeemed_at
      ? new Date(v.redeemed_at).toLocaleDateString()
      : "";
    const redeemedSalon = v.redeemed_salon_name || v.salon_name || "-";
    return isRedeemed
      ? redeemedAt
        ? `${redeemedSalon}<br>${redeemedAt}`
        : redeemedSalon
      : "—";
  }
  function buildActionsCell(v) {
    return `
      <button class="button vms-act-redeem" data-code="${v.code}">Redeem</button>
      <button class="button vms-act-void" data-code="${v.code}">Void</button>
      <a class="button" target="_blank" href="${VMSAdmin.ajax}?action=vms_voucher_pdf&nonce=${encodeURIComponent(VMSAdmin.nonce)}&code=${encodeURIComponent(v.code)}">Download PDF</a>
    `;
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
    const $table = jQuery("#vms-vouchers-table");
    const $filters = jQuery("#vms-filters");
    const dt = $table.DataTable({
      processing: true,
      serverSide: true,
      stateSave: true,
      pageLength: 50,
      order: [],
      ajax: function (data, callback) {
        const formData = Object.fromEntries(new FormData($filters[0]).entries());
        const dtSearch = data.search && data.search.value ? data.search.value : "";
        if (dtSearch) formData.q = dtSearch;
        jQuery
          .post(VMSAdmin.ajax, {
            action: "vms_fetch_vouchers",
            nonce: VMSAdmin.nonce,
            draw: data.draw,
            start: data.start,
            length: data.length,
            status: formData.status || "",
            salon_id: formData.salon_id || "",
            q: formData.q || "",
            date_from: formData.date_from || "",
            date_to: formData.date_to || "",
          })
          .done(function (res) {
            if (!res || !res.success) {
              callback({ draw: data.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
              return;
            }
            const items = (res.data && res.data.items) || [];
            const total = res.data && typeof res.data.total === "number" ? res.data.total : items.length;
            callback({
              draw: data.draw,
              recordsTotal: total,
              recordsFiltered: total,
              data: items,
            });
          })
          .fail(function () {
            callback({ draw: data.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
          });
      },
      columns: [
        {
          data: "code",
          render: function (data, type, row) {
            if (type !== "display") return data;
            const code = row.code || "";
            return `<a href="${VMSAdmin.base}?page=vms-admin-voucher-details&code=${encodeURIComponent(code)}">${code}</a>`;
          },
        },
        { data: null, render: function (_, type, row) { return type === "display" ? buildOrderCell(row) : ""; } },
        { data: null, render: function (_, type, row) { const wp = row.wp || {}; return type === "display" ? (wp.product_name || row.title || "-") : ""; } },
        { data: null, render: function (_, type, row) { const wp = row.wp || {}; return type === "display" ? (wp.product_price || row.face_value || "0.00") : ""; } },
        { data: null, render: function (_, type, row) { const wp = row.wp || {}; return type === "display" ? (wp.grand_total || row.order_total || row.face_value || "0.00") : ""; } },
        { data: null, render: function (_, type, row) { return type === "display" ? buildCustomerCell(row) : ""; } },
        { data: "created_at", render: function (data, type) { return type === "display" && data ? new Date(data).toLocaleDateString() : ""; } },
        { data: "expires_at", render: function (data, type) { return type === "display" && data ? new Date(data).toLocaleDateString() : ""; } },
        { data: "status", render: function (data, type) { return type === "display" ? (data || "") : data; } },
        { data: null, render: function (_, type, row) { return type === "display" ? buildRedeemedCell(row) : ""; } },
        { data: null, orderable: false, searchable: false, render: function (_, type, row) { return type === "display" ? buildActionsCell(row) : ""; } },
      ],
      stateSaveParams: function (settings, state) {
        state.vmsFilters = Object.fromEntries(new FormData($filters[0]).entries());
      },
      stateLoadParams: function (settings, state) {
        if (!state.vmsFilters) return;
        Object.entries(state.vmsFilters).forEach(([key, val]) => {
          const $field = $filters.find(`[name="${key}"]`);
          if ($field.length) $field.val(val);
        });
      },
    });

    $filters.on("submit", function (e) {
      e.preventDefault();
      dt.ajax.reload();
    });
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
