import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHILD_NAME, LINES, NAMED_LINES, PREFIX_LINES, QUIZ_ID, REUSED_LINES, audioCues, bare, type LineId } from '../../src/data/lines'

const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8')) as {
  voices: Record<string, { name: string }>
  clips: Record<string, { text: string }>
}
const oldLines = JSON.parse(fs.readFileSync('tests/fixtures/old-quiz-lines.json', 'utf8')) as string[]
const source = fs
  .readdirSync('src', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => fs.readFileSync(`${entry.parentPath}/${entry.name}`, 'utf8'))
  .join('\n')

/** The fixture's spelling: no diacritics or punctuation, ا for أإآ, ه for ة, ي for ى. */
function normal(text: string): string {
  return bare(text)
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^ء-ي\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

const spokenLines = (Object.keys(LINES) as LineId[]).filter((id) => !REUSED_LINES.includes(id))

describe('the lines of version 2', () => {
  it('keeps the permanent id and her name in one place', () => {
    expect(QUIZ_ID).toBe('candy-shop')
    expect(CHILD_NAME).toBe('ديما')
  })

  // The brief is kept on the owner's machine, outside the repository: where it is missing (the
  // deploy), this comparison is skipped; every other rule about the lines still runs.
  it.skipIf(!fs.existsSync('DESIGN.md'))('has every line of the brief word for word, with the changes of §8.6, §9, §10.4, §11.7 and §12.3', () => {
    const brief = fs.readFileSync('DESIGN.md', 'utf8')
    const v2 = brief.slice(brief.indexOf('| id | text |'), brief.indexOf('## 5.'))
    const v3 = brief.slice(brief.indexOf('### 8.6'), brief.indexOf('### 8.7')) + brief.slice(brief.indexOf('## 9.'))
    const changed = new Map<string, string>()
    for (const row of v3.split('\n').filter((r) => /^\| [cg]\//.test(r))) {
      const [, id, text] = row.split('|').map((x) => x.trim())
      // «c/two-bags (suffix, replaces c/mix)»: the id is the first word; later sections win.
      changed.set(id!.replace(/\s*\(.*\)$/, ''), text!)
    }
    // The «removed» rows (§8.6, §10.4, §11.7 and §12.3).
    const removedRows = v3.split('\n').filter((r) => /^\| removed \|/.test(r))
    expect(removedRows).toHaveLength(4)
    const removed = removedRows.flatMap((r) => [...r.matchAll(/[cg]\/[a-z0-9-]+/g)].map((m) => m[0]))
    for (const id of ['c/mix', 'g/mix', 'g/mix-new']) expect(removed).toContain(id)
    // §11: no days, no «كيسين», no sentence on a wrong answer, no points taken away, the goal of 100.
    const third = ['g/sticker', 'g/bigger-first', 'g/closed', 'g/new-day', 'g/points-no', 'g/day-down', 'g/goal-150', 'g/goal-200', 'g/two-bags', 'g/two-bags-new', 'g/house-done', 'c/two-bags', 'c/wait-1', 'c/wait-2', 'c/wait-3', 'c/too-few', 'c/too-many']
    for (const id of third) expect(removed).toContain(id)
    // §12: the count-on order with its bag and stickers is gone.
    for (const id of ['c/may-i', 'g/hold', 'g/pick']) expect(removed).toContain(id)
    for (const id of removed) changed.delete(id)
    for (const [id, text] of changed) expect(LINES[id as LineId], id).toBe(text)
    for (const gone of ['g/decorate', 'g/need-more', ...removed]) expect(gone in LINES, gone).toBe(false)
    for (const id of spokenLines) {
      if (changed.has(id)) continue
      expect(v2.includes(LINES[id]), `${id}: ${LINES[id]}`).toBe(true)
    }
  })

  it('says her name only in the named lines, at most', () => {
    for (const id of Object.keys(LINES) as LineId[]) expect(LINES[id].includes(CHILD_NAME), id).toBe(NAMED_LINES.includes(id))
  })

  it('repeats nothing from the earlier quizzes (the reused numbers, «زائد» and «يساوي» aside)', () => {
    const old = new Set(oldLines.map(normal))
    for (const id of spokenLines) expect(old.has(normal(LINES[id])), `${id}: ${LINES[id]}`).toBe(false)
    // The reused recordings are the only overlap, on purpose.
    for (const id of REUSED_LINES) expect(old.has(normal(LINES[id])), id).toBe(true)
  })

  it('has no praise or consolation, and no teacher voice', () => {
    const banned = ['عفيه', 'كفو', 'تمام التمام', 'يا سلام', 'ما شاء الله', 'هلا والله', 'ما عليه', 'قريبه', 'نعدهم سوا', 'برافو', 'شطاره', 'احسنت', 'رائع', 'ممتاز', 'جواب', 'غلط', 'صح']
    for (const id of spokenLines) {
      const text = ` ${normal(LINES[id])} `
      for (const phrase of banned) expect(text.includes(` ${phrase} `) || text.includes(` ${phrase}`), `${id} has «${phrase}»`).toBe(false)
    }
  })

  it('keeps the older rules: Kuwaiti words, no sighs, counts said in full, nobody addressed', () => {
    const rules = /…|\.\.\.|(?<![؀-ۿ])(أوه|اوه|آه|نحوط|ذب|سيكل|فديت|ثلاث|خمس|ست|سبع|ثمان|تسع)(?![؀-ۿ])/
    const addressed = /(?<![؀-ۿ])(شفتي|شفت|عليج|عليك|إنتي|أنتي|انتي|إنت|أنت|المسي|عدي|اختاري|حطي|تبين)(?![؀-ۿ])/
    for (const cue of audioCues()) {
      expect(cue.text, cue.id).not.toMatch(rules)
      // The named lines may speak to her (§8.5); every other line stays neutral.
      if (!NAMED_LINES.includes(cue.id.replace(/^ar\//, '') as LineId)) expect(cue.text, cue.id).not.toMatch(addressed)
      expect(cue.text, cue.id).not.toMatch(/[A-Za-z]/)
    }
  })

  it('ends full lines with «.», «!» or «؟»; prefix lines have no end mark', () => {
    for (const id of Object.keys(LINES) as LineId[]) {
      if (PREFIX_LINES.includes(id)) expect(LINES[id], id).not.toMatch(/[.!؟?]$/)
      else expect(LINES[id], id).toMatch(/[.!؟]$/)
    }
  })

  it('keeps the cue list to version 2: numbers, «زائد», «يساوي», and the c/ and g/ lines', () => {
    for (const cue of audioCues()) expect(cue.id, cue.id).toMatch(/^ar\/(n\/\d+|ui\/(plus|equal)|c\/[a-z0-9-]+|g\/[a-z0-9-]+)$/)
    const ids = audioCues().map((cue) => cue.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('agrees with every recording it reuses, and plays only clips that are on the list', () => {
    const cues = new Map(audioCues().map((cue) => [cue.id, cue.text]))
    for (const id of [...Array.from({ length: 11 }, (_, n) => `ar/n/${n}`), 'ar/ui/plus', 'ar/ui/equal']) {
      expect(manifest.clips[id]?.text, id).toBe(cues.get(id))
      expect(fs.existsSync(`public/audio/${id}.mp3`), id).toBe(true)
    }
    for (const match of source.matchAll(/line\('([a-z0-9/-]+)'\)/g)) expect(Object.keys(LINES), match[1]).toContain(match[1])
  })

  it('uses every line somewhere in the game', () => {
    for (const id of Object.keys(LINES)) {
      const family = id.replace(/-\d+$/, '')
      const dealt = /-\d+$/.test(id) && family === 'c/not-my-house' && source.includes('NOT_MY_HOUSE_IDS')
      const counted = /^g\/(near-\d|goal-(25|50|75))$/.test(id) && source.includes('`g/near-${') && source.includes('`g/goal-${')
      expect(source.includes(`'${id}'`) || dealt || counted, id).toBe(true)
    }
  })
})
