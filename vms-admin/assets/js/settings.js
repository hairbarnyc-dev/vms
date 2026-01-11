(function ($) {
  function openMedia(target) {
    const frame = wp.media({
      title: "Select file",
      button: { text: "Use this file" },
      multiple: false,
    });
    frame.on("select", function () {
      const file = frame.state().get("selection").first().toJSON();
      const $input = $(target);
      if ($input.length) {
        $input.val(file.url).trigger("change");
        const $preview = $input.closest("td").find(".vms-media-preview img");
        if ($preview.length) $preview.attr("src", file.url);
      }
    });
    frame.open();
  }

  function initTabs() {
    const $tabs = $(".vms-settings-tabs .nav-tab");
    if (!$tabs.length) return;
    $tabs.on("click", function (e) {
      e.preventDefault();
      const target = $(this).data("tab");
      $tabs.removeClass("nav-tab-active");
      $(this).addClass("nav-tab-active");
      $(".vms-settings-panel").hide();
      $(target).show();
    });
    $tabs.first().trigger("click");
  }

  function initVoucherSync() {
    const $start = $("#vms-sync-start");
    const $stop = $("#vms-sync-stop");
    const $status = $("#vms-sync-status");
    const $batch = $("#vms-sync-batch");
    const $panel = $("#vms-tab-sync");
    if (!$start.length || !$status.length) return;

    let running = false;
    let offset = 0;
    let totals = {
      created: 0,
      updated: 0,
      codeUpdated: 0,
      skipped: 0,
      processed: 0,
      total: 0,
      errors: 0,
    };

    const ajaxUrl =
      (window.VMSAdmin && VMSAdmin.ajax) ||
      ($panel.length && $panel.data("ajax")) ||
      window.ajaxurl;
    const ajaxNonce =
      (window.VMSAdmin && VMSAdmin.nonce) ||
      ($panel.length && $panel.data("nonce")) ||
      "";

    const renderStatus = (message, errorText) => {
      const detail = `Processed ${totals.processed}/${totals.total} | Created ${totals.created} | Updated ${totals.updated} | Code Updated ${totals.codeUpdated} | Skipped ${totals.skipped} | Errors ${totals.errors}`;
      const suffix = errorText ? ` | ${errorText}` : "";
      $status.text(message ? `${message} — ${detail}${suffix}` : `${detail}${suffix}`);
    };

    if (!ajaxUrl) {
      renderStatus("Sync unavailable", "Missing AJAX URL");
      return;
    }

    renderStatus("Ready");

    const syncChunk = async () => {
      if (!running) return;
      const limit = Math.max(1, Math.min(100, parseInt($batch.val(), 10) || 25));
      renderStatus("Syncing");
      try {
        const res = await jQuery.post(ajaxUrl, {
          action: "vms_sync_vouchers",
          nonce: ajaxNonce,
          offset,
          limit,
        });
        if (!res || !res.success) {
          const msg = res && res.data ? String(res.data) : "Sync failed";
          throw new Error(msg);
        }
        const data = res.data || {};
        totals.processed += data.processed || 0;
        totals.total = data.total || totals.total;
        totals.created += data.created || 0;
        totals.updated += data.updated || 0;
        totals.codeUpdated += data.code_updated || 0;
        totals.skipped += data.skipped || 0;
        totals.errors += (data.errors || []).length;
        offset = data.next_offset || offset;
        if (data.done) {
          running = false;
          $start.prop("disabled", false);
          $stop.prop("disabled", true);
          renderStatus("Sync complete");
          return;
        }
        setTimeout(syncChunk, 150);
      } catch (err) {
        running = false;
        $start.prop("disabled", false);
        $stop.prop("disabled", true);
        renderStatus("Sync stopped (error)", err && err.message ? err.message : "Unknown error");
      }
    };

    $start.on("click", function () {
      if (running) return;
      running = true;
      offset = 0;
      totals = {
        created: 0,
        updated: 0,
        codeUpdated: 0,
        skipped: 0,
        processed: 0,
        total: 0,
        errors: 0,
      };
      $start.prop("disabled", true);
      $stop.prop("disabled", false);
      renderStatus("Starting");
      syncChunk();
    });

    $stop.on("click", function () {
      if (!running) return;
      running = false;
      $start.prop("disabled", false);
      $stop.prop("disabled", true);
      renderStatus("Sync stopped");
    });
  }

  function initSalonSync() {
    const $btn = $("#vms-sync-salons");
    const $status = $("#vms-sync-salons-status");
    const $panel = $("#vms-tab-sync");
    if (!$btn.length || !$status.length) return;

    const ajaxUrl =
      (window.VMSAdmin && VMSAdmin.ajax) ||
      ($panel.length && $panel.data("ajax")) ||
      window.ajaxurl;
    const ajaxNonce =
      (window.VMSAdmin && VMSAdmin.nonce) ||
      ($panel.length && $panel.data("nonce")) ||
      "";

    const renderStatus = (message) => {
      $status.text(message);
    };

    if (!ajaxUrl) {
      renderStatus("Sync unavailable: missing AJAX URL.");
      return;
    }

    $btn.on("click", async function () {
      $btn.prop("disabled", true);
      renderStatus("Syncing salons...");
      try {
        const res = await jQuery.post(ajaxUrl, {
          action: "vms_sync_salons",
          nonce: ajaxNonce,
        });
        if (!res || !res.success) throw new Error("Sync failed");
        const data = res.data || {};
        renderStatus(
          `Complete — Created ${data.created || 0} | Updated ${data.updated || 0} | Skipped ${data.skipped || 0} | Errors ${(data.errors || []).length}`
        );
      } catch (err) {
        renderStatus(
          `Sync failed${err && err.message ? `: ${err.message}` : ""}`
        );
      } finally {
        $btn.prop("disabled", false);
      }
    });
  }

  $(function () {
    $(document).on("click", ".vms-media-upload", function (e) {
      e.preventDefault();
      const target = $(this).data("target");
      if (target) openMedia(target);
    });
    initTabs();
    initVoucherSync();
    initSalonSync();
  });
})(jQuery);
