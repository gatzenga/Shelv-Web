import { version } from '@/../package.json'

export const appName = 'Shelv Web'

const repository = { url: 'https://github.com/gatzenga/Shelv-Web' }

export function getAppInfo() {
  return {
    name: appName,
    version,
  }
}

export const lrclibClient = `${appName} v${version} (${repository.url})`
