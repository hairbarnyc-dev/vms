document.addEventListener('DOMContentLoaded', () => {
  let sec = Number(window.__resendSec || 0)
  const btn = document.getElementById('btnResend')
  const label = document.getElementById('resendTimer')
  const tick = () => {
    if (!btn || !label) return
    if (sec > 0) {
      btn.disabled = true
      label.textContent = `You can resend in ${sec}s`
      sec -= 1
      setTimeout(tick, 1000)
    } else {
      btn.disabled = false
      label.textContent = ''
    }
  }
  tick()
})
