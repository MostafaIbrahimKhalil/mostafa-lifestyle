// بيبني ملفات القرآن اللي التطبيق بيقرا منها (public/data/quran) — بيتشغّل مرة واحدة بس.
// المصادر:
//   النص: quran-json (الرسم العثماني من موسوعة القرآن الكريم quranenc.com) — CC BY-SA 4.0
//   الأجزاء والصفحات والأرباع: quran-meta (رواية حفص) — MIT
// الاستخدام: node scripts/build-quran-data.mjs <مسار quran.json> <مسار node_modules فيه quran-meta>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [quranJsonPath, metaModules] = process.argv.slice(2)
if (!quranJsonPath || !metaModules) {
  console.error('usage: node scripts/build-quran-data.mjs <quran.json> <node_modules with quran-meta>')
  process.exit(1)
}

const hafsEntry = path.join(metaModules, 'quran-meta', 'dist', 'hafs.js')
const { getAyahMeta, getSurahMeta, meta } = await import(pathToFileURL(hafsEntry).href)

const quran = JSON.parse(fs.readFileSync(quranJsonPath, 'utf8'))
const out = path.resolve('public/data/quran')
fs.mkdirSync(out, { recursive: true })

const juzs = Array.from({ length: 30 }, () => [])
const surahs = []
let ayahId = 0
let totalPages = 0

for (const s of quran) {
  const sm = getSurahMeta(s.id)
  if (sm.ayahCount !== s.verses.length) throw new Error(`عدد الآيات مختلف في سورة ${s.id}`)
  const first = getAyahMeta(sm.firstAyahId)
  surahs.push({
    n: s.id,
    name: s.name,
    ayahs: s.verses.length,
    type: s.type === 'meccan' ? 'مكية' : 'مدنية',
    juz: first.juz,
    page: first.page,
  })
  for (const v of s.verses) {
    ayahId++
    const m = getAyahMeta(ayahId)
    if (m.surah !== s.id || m.ayah !== v.id) throw new Error(`ترتيب الآيات مختلف عند ${s.id}:${v.id}`)
    const row = { s: s.id, a: v.id, t: v.text, p: m.page }
    if (m.isStartOfQuarter) row.q = m.rubAlHizbId // بداية ربع حزب
    if (m.isSajdahAyah) row.sj = 1
    juzs[m.juz - 1].push(row)
    totalPages = Math.max(totalPages, m.page)
  }
}

if (ayahId !== meta.numAyahs) throw new Error('عدد الآيات الكلي غلط')

const index = []
juzs.forEach((rows, i) => {
  const n = String(i + 1).padStart(2, '0')
  fs.writeFileSync(path.join(out, `juz-${n}.json`), JSON.stringify(rows))
  index.push({
    juz: i + 1,
    ayahs: rows.length,
    start: [rows[0].s, rows[0].a],
    end: [rows.at(-1).s, rows.at(-1).a],
    pages: [rows[0].p, rows.at(-1).p],
  })
})

fs.writeFileSync(
  path.resolve('src/data/quran-index.json'),
  JSON.stringify({ totalAyahs: ayahId, totalPages, juzs: index, surahs }, null, 0),
)
console.log(`تمام: ${ayahId} آية، ${totalPages} صفحة، ${juzs.length} جزء`)
