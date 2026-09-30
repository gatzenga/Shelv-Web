import { MD5 } from 'crypto-js'

export const saltWord = '40n50kuPl4y3r'

export function genPasswordToken(password: string) {
  return MD5(`${password}${saltWord}`).toString()
}

export function genEncodedPassword(password: string) {
  return `enc:${toHex(password)}`
}

export function toHex(s: string) {
  return s
    .split('')
    .map((c) => c.charCodeAt(0).toString(16))
    .join('')
}
