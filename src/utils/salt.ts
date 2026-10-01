import { MD5 } from 'crypto-js'

export const saltWord = '40n50kuPl4y3r'

export function genPasswordToken(password: string) {
  return MD5(`${password}${saltWord}`).toString()
}
