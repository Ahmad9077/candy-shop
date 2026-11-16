// Packs the preview build (dist/) into one self-contained page, preview/candy-shop.html: script,
// styles, fonts, favicon and the recorded clips are all inlined, so it plays inside a sandboxed
// iframe with no network. Run `npm run build:preview` first (or `npm run build:artifact`).
import fs from 'node:fs'
import path from 'node:path'
import { audioCues } from '../src/data/lines.ts'

const dist = 'dist'
const html = fs.readFileSync(`${dist}/index.html`, 'utf8')
const scriptPath = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1]
const stylePath = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1]
if (!scriptPath || !stylePath) throw new Error('Could not find the built script and stylesheet in dist/index.html.')

const mime = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' }
const dataUri = (file) => `data:${mime[path.extname(file)] ?? 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`

let css = fs.readFileSync(`${dist}/${stylePath}`, 'utf8')
css = css.replace(/url\((['"]?)([^'")]+)\1\)/g, (whole, _q, ref) => {
  if (ref.startsWith('data:') || ref.startsWith('#')) return whole
  const file = path.join(dist, path.dirname(stylePath), ref.split(/[?#]/)[0])
  return fs.existsSync(file) ? `url(${dataUri(file)})` : whole
})

const js = fs.readFileSync(`${dist}/${scriptPath}`, 'utf8')
if (/assets\/[\w.-]+\.(js|css|woff2|png|svg|mp3)/.test(js)) throw new Error('The script still points at a file in assets/: it would need the network.')
const safeJs = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')

const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8'))
const audio = {}
// Only the clips the game plays (the manifest still lists retired ones until the next recording).
// ...and only takes recorded with the text the game says now (the player skips the others).
const inUse = new Map(audioCues().map((cue) => [cue.id, cue.text]))
for (const id of Object.keys(manifest.clips).filter((clip) => inUse.get(clip) === manifest.clips[clip].text)) {
  const file = `public/audio/${id}.mp3`
  if (fs.existsSync(file)) audio[id] = fs.readFileSync(file).toString('base64')
}

const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
const page = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#fff6e9">
<title>البقالة · نسخة تجريبية</title>
<link rel="icon" href="${dataUri('public/favicon.svg')}" type="image/svg+xml">
<style>${css}</style>
<script>window.__CANDY_AUDIO__ = ${JSON.stringify(audio)};</script>
</head>
<body>
<div id="root"></div>
<script type="module">${safeJs}</script>
</body>
</html>
`
fs.mkdirSync('preview', { recursive: true })
fs.writeFileSync('preview/candy-shop.html', page)
const size = Buffer.byteLength(page)
if (size > 16 * 1024 * 1024) throw new Error(`preview/candy-shop.html is ${size} bytes: over 16 MB.`)
console.log(`preview/candy-shop.html: ${(size / 1024).toFixed(0)} KB (${Object.keys(audio).length} clips inlined)`)
