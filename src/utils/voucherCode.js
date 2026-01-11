import crypto from 'crypto'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const randomBlock = (len) => {
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += CHARS[crypto.randomInt(0, CHARS.length)]
  }
  return out
}

export const generateVoucherCode = () => {
  const prefix = randomBlock(8)
  const suffix = String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0')
  return `${prefix}-${suffix}`
}
