// The same links as on vkugler.app and in the About screen of the Shelv app
export const aboutLinks = [
  { key: 'coffee', url: 'https://ko-fi.com/R6R61YBEZK' },
  { key: 'github', url: 'https://github.com/gatzenga/Shelv-Web' },
  { key: 'discord', url: 'https://discord.gg/UdJK5mpmZu' },
  { key: 'website', url: 'https://vkugler.app' },
  { key: 'contact', url: 'mailto:contact@vkugler.app' },
] as const

export type AboutLink = (typeof aboutLinks)[number]['key']
