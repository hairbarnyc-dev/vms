import { Router } from 'express'
import { webLogin } from '../../controllers/auth.controller.js'

const r = Router()

r.get('/login', (req, res) => {
  const showError = req.query.error === '1'
  res.render('auth/login', { showError })
})

r.post('/login', webLogin)

r.get('/logout', (req, res) => {
  res.clearCookie('token')
  res.redirect('/login')
})

export default r
