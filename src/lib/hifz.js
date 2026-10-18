import QURAN from '../data/quran-index.json'

export const SURAH = Object.fromEntries(QURAN.surahs.map((s) => [s.n, s]))

export const HIFZ_STATUS = {
  learning: { label: 'بحفظ فيها', cls: 'st-building' },
  todo: { label: 'عليها الدور', cls: 'st-new' },
  paused: { label: 'بدأتها وسبتها', cls: 'st-slipped' },
  memorized: { label: 'حافظها ✓', cls: 'st-formed' },
}

export function hifzSummary(rows) {
  let ayahs = 0
  for (const r of rows) {
    const total = SURAH[r.surah].ayahs
    if (r.status === 'memorized') ayahs += total
    else ayahs += Math.min(total, r.reached || 0)
  }
  return { ayahs, ratio: ayahs / QURAN.totalAyahs, memorized: rows.filter((r) => r.status === 'memorized').length }
}

// أنهي سورة تكمّلها الأول: اللي بتحفظ فيها، وبعدين اللي سبتها ونسبتها أعلى، وبعدين اللي عليها الدور بالأولوية
export function nextHifz(rows) {
  const learning = rows.filter((r) => r.status === 'learning').sort((a, b) => a.priority - b.priority)
  if (learning.length) return learning[0]
  const paused = rows
    .filter((r) => r.status === 'paused')
    .sort((a, b) => (b.reached || 0) / SURAH[b.surah].ayahs - (a.reached || 0) / SURAH[a.surah].ayahs)
  if (paused.length) return paused[0]
  return rows.filter((r) => r.status === 'todo').sort((a, b) => a.priority - b.priority)[0]
}
