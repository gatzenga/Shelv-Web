import { appName } from '@/utils/appName'

export async function queryServerInfo(url: string) {
  try {
    const query = {
      // no login: this is asked before anybody is signed in
      v: '1.16.0',
      c: appName,
      f: 'json',
    }

    const queries = new URLSearchParams(query).toString()

    const response = await fetch(`${url}/rest/ping.view?${queries}`, {
      method: 'GET',
    })
    const data = await response.json()

    const extensionsMap: Record<string, number[]> = {}

    if (data['subsonic-response'].openSubsonic) {
      const response = await fetch(
        `${url}/rest/getOpenSubsonicExtensions.view?${queries}`,
        {
          method: 'GET',
        },
      )

      const eData = await response.json()
      const extensions = eData['subsonic-response'].openSubsonicExtensions

      for (const extension of extensions) {
        extensionsMap[extension.name] = extension.versions
      }
    }

    return {
      protocolVersion: data['subsonic-response'].version,
      protocolVersionNumber: parseInt(
        data['subsonic-response'].version.replaceAll('.', ''),
      ),
      serverType: data['subsonic-response'].type.toLowerCase() || 'subsonic',
      extensionsSupported: extensionsMap,
    }
  } catch (_) {
    return {
      protocolVersion: '1.16.0',
      protocolVersionNumber: 1160,
      serverType: 'subsonic',
    }
  }
}
