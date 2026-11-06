// Persistent same-human bindings (trust on first use): the first World ID `sub` that approves for a
// payee/wallet owns it; later approvals must come from the same human.
// Stored as one JSON file, written atomically (temp file + fsync + rename) so a crash or a
// pause/resume never leaves a half-written file. A corrupt file is an error, never silently reset:
// resetting would let a different human take over every binding.
import { readFile, mkdir, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

export function createBindings(file) {
  let queue = Promise.resolve()
  // Serialise every read-modify-write so two simultaneous approvals cannot both claim the same key.
  const run = (fn) => {
    const p = queue.then(fn)
    queue = p.catch(() => {})
    return p
  }

  async function load() {
    let raw
    try {
      raw = await readFile(file, 'utf8')
    } catch (e) {
      if (e.code === 'ENOENT') return {}
      throw new Error(`bindings store unreadable (${file}): ${e.message}`)
    }
    try {
      const parsed = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      return parsed
    } catch (e) {
      throw new Error(`bindings store corrupt (${file}): ${e.message}`)
    }
  }

  async function save(bindings) {
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    const fh = await open(tmp, 'w')
    try {
      await fh.writeFile(JSON.stringify(bindings, null, 2))
      await fh.sync()
    } finally {
      await fh.close()
    }
    await rename(tmp, file)
  }

  return {
    /** @returns {Promise<'new'|'same'|'different'>} 'new' = first approval, now bound to this sub. */
    bindOrCheck: (key, sub) =>
      run(async () => {
        const bindings = await load()
        const bound = bindings[key]
        if (bound) return bound === sub ? 'same' : 'different'
        bindings[key] = sub
        await save(bindings)
        return 'new'
      }),
    /** Read a binding without changing anything. */
    get: (key) => run(async () => (await load())[key]),
  }
}
