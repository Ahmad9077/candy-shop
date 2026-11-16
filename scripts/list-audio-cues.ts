// Lists every narration cue with its text. `--json` for the generator; `--missing` for the clips
// that are not recorded yet (they resolve silently in the game until they are).
import fs from 'node:fs'
import { audioCues } from '../src/data/lines.ts'

const manifest = JSON.parse(fs.readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8')) as { clips: Record<string, unknown> }
const all = audioCues()
const cues = process.argv.includes('--missing') ? all.filter((cue) => !(cue.id in manifest.clips)) : all
const total = cues.reduce((sum, cue) => sum + cue.text.length, 0)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(cues, null, 2))
} else {
  for (const cue of cues) console.log(`${cue.id}\t${cue.text}${cue.id in manifest.clips ? '\t(recorded)' : ''}`)
  const missing = all.filter((cue) => !(cue.id in manifest.clips))
  console.error(`${cues.length} clips, ${total} characters; ${missing.length} not recorded yet (${missing.reduce((s, c) => s + c.text.length, 0)} characters)`)
}
