(function($){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function fetchSalons(){
    const res = await $.post(VMSAdmin.ajax, { action:'vms_fetch_salons', nonce: VMSAdmin.nonce });
    if (!res || !res.success) throw new Error('AJAX failed');
    return Array.isArray(res.data) ? res.data : [];
  }

  function render(list){
    const $tbody = $('#vms-salons-tbody');
    if (!Array.isArray(list) || !list.length){
      $tbody.html('<tr><td colspan="5"><em>No salons found.</em></td></tr>');
      return;
    }
    const rows = list.map(s=>{
      const active = (s.is_active===1 || s.is_active===true || String(s.is_active)==='1') ? 'Yes' : 'No';
      return `<tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.email)}</td>
        <td>${esc(s.city)}</td>
        <td>${esc(s.region || '')}</td>
        <td>${active}</td>
      </tr>`;
    }).join('');
    $tbody.html(rows);
  }

  $(async function(){
    try { render(await fetchSalons()); }
    catch(e){ console.error(e); $('#vms-salons-tbody').html('<tr><td colspan="5">Error loading salons</td></tr>'); }
  });
})(jQuery);
