import nodemailer from 'nodemailer'
import 'dotenv/config'

let transporter
if (process.env.MAIL_HOST && process.env.MAIL_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  })
} else {
  // Fallback: dump to console
  transporter = {
    sendMail: async (opts) => {
      console.log('=== MAIL (dev fallback) ===\nTo:', opts.to, '\nSubj:', opts.subject, '\nHTML:\n', opts.html)
      return { messageId: 'local-dev' }
    }
  }
}

export const sendMail = async ({ to, subject, html }) => {
  const from = process.env.MAIL_FROM || 'VMS <no-reply@vms.local>'
  return transporter.sendMail({ from, to, subject, html })
}
