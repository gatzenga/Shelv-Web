// Files with settings or a session are for the user the container runs as,
// nobody else. The mode is set explicitly, so it does not depend on the umask
// and is also fixed on files that were created with wider rights before.
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function writePrivateFile(file: string, content: string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })

  const temporary = `${file}.tmp`
  await writeFile(temporary, content, { encoding: 'utf-8', mode: 0o600 })
  await chmod(temporary, 0o600)
  await rename(temporary, file)
}
