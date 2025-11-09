import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const hashPassword = (plain) => bcrypt.hash(plain, 10)
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash)

export const signJwt = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '12h' })

export const verifyJwt = (token) => jwt.verify(token, process.env.JWT_SECRET)
