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

  $(function () {
    $(document).on("click", ".vms-media-upload", function (e) {
      e.preventDefault();
      const target = $(this).data("target");
      if (target) openMedia(target);
    });
    initTabs();
  });
})(jQuery);
