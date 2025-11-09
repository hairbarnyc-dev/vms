import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { notFound, errorHandler } from './middleware/error.js'
import webAuth from './routes/web/web.auth.routes.js'
import accountRoutes from './routes/web/web.account.routes.js'
import webDashboard from './routes/web/web.dashboard.routes.js'
import webVouchers from './routes/web/web.vouchers.routes.js'
import apiAuth from './routes/api/auth.routes.js'
import apiVouchers from './routes/api/vouchers.routes.js'
import apiSalons from './routes/api/salons.routes.js'
import apiCampaigns from './routes/api/campaigns.routes.js'
import apiReports from './routes/api/reports.routes.js'
import webSalons from './routes/web/web.salons.routes.js'

const app = express()
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use('/public', express.static(path.join(__dirname, '..', 'public')))
app.use(express.static(path.join(__dirname, '..', 'public')))

app.use(rateLimit({ windowMs: 60_000, max: 300 }))

app.use((req, res, next) => {
  if (res.locals.user === undefined) res.locals.user = null
  if (res.locals.isSalonUser === undefined) res.locals.isSalonUser = false
  next()
})

app.use((req, res, next) => {
  res.locals.currentPath = req.path || '/'
  res.locals.startsWith = (p) => (res.locals.currentPath + '/').startsWith(p.replace(/\/?$/, '/') )
  res.locals.equalsPath  = (p) => res.locals.currentPath === p
  next()
})

app.use('/', webAuth)
app.use('/', accountRoutes)
app.use('/dashboard', webDashboard)
app.use('/vouchers', webVouchers)
app.use('/salons', webSalons)

app.use('/api/v1/auth', apiAuth)
app.use('/api/v1/vouchers', apiVouchers)
app.use('/api/v1/salons', apiSalons)
app.use('/api/v1/campaigns', apiCampaigns)
app.use('/api/v1/reports', apiReports)

app.use(notFound)
app.use(errorHandler)

export default app
