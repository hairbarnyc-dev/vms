document.addEventListener('DOMContentLoaded', function () {
  const table = document.getElementById('vouchers-table')
  const tbody = table ? table.querySelector('tbody') : null
  const pagination = document.getElementById('vouchers-pagination')
  const countEl = document.getElementById('vouchers-count')
  const pageSizeSelect = document.getElementById('vouchers-page-size')
  const filtersForm = document.querySelector('form')

  if (!table || !tbody || !pagination || !countEl || !pageSizeSelect) return

  const buildQuery = (page) => {
    const formData = new FormData(filtersForm)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(Number(pageSizeSelect.value || 50)))
    params.set('include_total', '1')
    for (const [key, val] of formData.entries()) {
      if (val === '' || val === null || val === undefined) continue
      params.set(key, String(val))
    }
    return params.toString()
  }

  const renderRows = (rows) => {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No vouchers found.</td></tr>'
      return
    }
    const html = rows
      .map((r) => {
        const statusClass = r.status === 'AVAILABLE' ? 'success' : r.status === 'REDEEMED' ? 'secondary' : 'danger'
        const created = r.created_at ? new Date(r.created_at).toLocaleString() : '-'
        return `
          <tr>
            <td>${r.code || '-'}</td>
            <td>${r.title || '-'}</td>
            <td>${r.salon_name || '-'}</td>
            <td>${r.order_source || '-'}</td>
            <td>${r.order_number || r.order_external_id || '-'}</td>
            <td>${r.face_value || 0} ${r.currency || ''}</td>
            <td><span class="badge bg-${statusClass}">${r.status || '-'}</span></td>
            <td>${created}</td>
            <td class="text-nowrap">
              <button class="btn btn-sm btn-success js-open-redeem"
                      data-code="${r.code || ''}" data-title="${r.title || ''}" data-salon-id="${r.salon_id || ''}">
                <i class="fa-solid fa-check"></i>
              </button>
              <a class="btn btn-sm btn-outline-primary" href="/vouchers/${r.id}/edit"><i class="fa-solid fa-pen"></i></a>
              <form method="post" action="/vouchers/${r.id}/delete" style="display:inline" onsubmit="return confirm('Delete this voucher?')">
                <button class="btn btn-sm btn-outline-danger"><i class="fa-solid fa-trash"></i></button>
              </form>
            </td>
          </tr>`
      })
      .join('')
    tbody.innerHTML = html
  }

  const renderPagination = (page, total, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const current = Math.min(page, totalPages)
    const btn = (label, target, disabled) =>
      `<li class="page-item ${disabled ? 'disabled' : ''}">
         <a class="page-link" href="#" data-page="${target}">${label}</a>
       </li>`

    let html = ''
    html += btn('Prev', current - 1, current <= 1)

    const start = Math.max(1, current - 2)
    const end = Math.min(totalPages, current + 2)
    for (let p = start; p <= end; p += 1) {
      html += `<li class="page-item ${p === current ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${p}">${p}</a>
      </li>`
    }

    html += btn('Next', current + 1, current >= totalPages)
    pagination.innerHTML = html
    countEl.textContent = `Total: ${total} — Page ${current} of ${totalPages}`
  }

  const loadPage = async (page) => {
    const query = buildQuery(page)
    const url = `/api/v1/vouchers?${query}`
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Loading…</td></tr>'
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('Request failed')
      const json = await res.json()
      const rows = Array.isArray(json?.data) ? json.data : []
      const total = Number(json?.total || 0)
      renderRows(rows)
      renderPagination(Number(page) || 1, total, Number(pageSizeSelect.value || 50))
      if (window.bootstrap) {
        document.querySelectorAll('.js-open-redeem').forEach((btn) => {
          btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code')
            document.getElementById('redeemCode').value = code
            const salonSelect = document.getElementById('redeemSalon')
            if (salonSelect) salonSelect.value = btn.getAttribute('data-salon-id') || ''
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('redeemModal'))
            modal.show()
          })
        })
      }
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Failed to load vouchers.</td></tr>'
      countEl.textContent = 'Total: 0'
    }
  }

  pagination.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-page]')
    if (!link) return
    e.preventDefault()
    const page = Number(link.getAttribute('data-page'))
    if (!page || page < 1) return
    loadPage(page)
  })

  pageSizeSelect.addEventListener('change', () => {
    loadPage(1)
  })

  if (filtersForm) {
    filtersForm.addEventListener('submit', (e) => {
      e.preventDefault()
      loadPage(1)
    })
  }

  loadPage(1)
})
