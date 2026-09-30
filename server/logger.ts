function format(level: string, message: string) {
  return `${new Date().toISOString()} [${level}] ${message}`
}

export const logger = {
  info(message: string) {
    console.log(format('info', message))
  },
  warn(message: string, error?: unknown) {
    const detail = error instanceof Error ? `: ${error.message}` : ''
    console.warn(format('warn', `${message}${detail}`))
  },
  error(message: string, error?: unknown) {
    console.error(format('error', message), error ?? '')
  },
}
