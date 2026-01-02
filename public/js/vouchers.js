document.addEventListener('DOMContentLoaded', function () {
  const redeemModalEl = document.getElementById('redeemModal')
  const voidModalEl   = document.getElementById('voidModal')
  if (!window.bootstrap || (!redeemModalEl && !voidModalEl)) return

  const redeemModal   = redeemModalEl ? new bootstrap.Modal(redeemModalEl) : null
  const voidModal     = voidModalEl ? new bootstrap.Modal(voidModalEl) : null

  document.querySelectorAll('.js-open-redeem').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code')
      document.getElementById('redeemCode').value = code
      const salonSelect = document.getElementById('redeemSalon')
      if (salonSelect) {
        salonSelect.value = btn.getAttribute('data-salon-id') || ''
      }
      redeemModal && redeemModal.show()
    })
  })

  document.querySelectorAll('.js-open-void').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code')
      document.getElementById('voidCode').value = code
      voidModal && voidModal.show()
    })
  })
})
