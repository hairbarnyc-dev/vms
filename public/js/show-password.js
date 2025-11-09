document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.js-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.input-group').querySelector('.js-pw')
      if (!input) return
      input.type = (input.type === 'password') ? 'text' : 'password'
      const i = btn.querySelector('i')
      if (i) i.classList.toggle('fa-eye-slash')
    })
  })
})
