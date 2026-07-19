import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Génère les radios automatiquement à partir de public/MP3 : chaque sous-dossier
// devient une radio (playlist), et les mp3 posés directement à la racine de MP3/
// (ex: la musique d'accueil) sont exposés à part, sans jamais toucher au code.
function radiosFromMp3Folder() {
  const virtualModuleId = 'virtual:radios'
  const resolvedVirtualModuleId = '\0' + virtualModuleId
  const mp3Dir = path.resolve(__dirname, 'public/MP3')

  function scan() {
    const radios = {}
    const rootTracks = []
    if (fs.existsSync(mp3Dir)) {
      for (const entry of fs.readdirSync(mp3Dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const folderPath = path.join(mp3Dir, entry.name)
          const tracks = fs.readdirSync(folderPath)
            .filter(f => f.toLowerCase().endsWith('.mp3'))
            .sort()
            .map(f => `/MP3/${entry.name}/${f}`)
          if (tracks.length > 0) radios[entry.name] = tracks
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
          rootTracks.push(`/MP3/${entry.name}`)
        }
      }
    }
    return { radios, rootTracks: rootTracks.sort() }
  }

  function moduleSource() {
    const { radios, rootTracks } = scan()
    return `export const RADIOS = ${JSON.stringify(radios, null, 2)};\nexport const ROOT_TRACKS = ${JSON.stringify(rootTracks, null, 2)};\n`
  }

  return {
    name: 'radios-from-mp3-folder',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },
    load(id) {
      if (id === resolvedVirtualModuleId) return moduleSource()
    },
    configureServer(server) {
      server.watcher.add(mp3Dir)
      server.watcher.on('all', (_event, file) => {
        if (file.replace(/\\/g, '/').includes('/public/MP3/')) {
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId)
          if (mod) server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), radiosFromMp3Folder()],
})
