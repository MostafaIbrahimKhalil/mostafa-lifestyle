// إحصائيات الورد: الختمة، والسلسلة، والوقت، وشبكة آخر ٤ أسابيع
import QURAN from '../data/quran-index.json'
import { addDays, dateKey, fromKey } from './dates.js'

export function juzPages(juz) {
  const j = QURAN.juzs[juz - 1]
  return j ? j.pages[1] - j.pages[0] + 1 : 20
}

export function quranStats(checks, settings, today) {
  const by = new Map()
  for (const c of checks) {
    if (!['wird', 'wird:pct', 'quran:sec'].includes(c.item)) continue
    const d = by.get(c.date) || {}
    if (c.item === 'wird') d.done = true
    if (c.item === 'wird:pct') d.pct = Number(c.value) || 0
    if (c.item === 'quran:sec') d.sec = Number(c.value) || 0
    by.set(c.date, d)
  }
  const day = (k) => by.get(k) || {}
  // السلسلة: أيام ورا بعض خلّصت فيها الورد (النهارده ما بيكسرهاش لو لسه ما خلصش)
  let current = 0
  let d = fromKey(today)
  if (!day(today).done) d = addDays(d, -1)
  while (day(dateKey(d)).done) {
    current++
    d = addDays(d, -1)
  }
  const doneDays = [...by.entries()].filter(([, v]) => v.done).map(([k]) => k).sort()
  let best = 0
  let run = 0
  let prev = null
  for (const k of doneDays) {
    run = prev && dateKey(addDays(fromKey(prev), 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  // آخر ٢٨ يوم: ١ = خلّص الورد، كسر = وصل لحد فين
  const grid = []
  for (let i = 27; i >= 0; i--) {
    const k = dateKey(addDays(fromKey(today), -i))
    const v = day(k)
    grid.push({ k, v: v.done ? 1 : (v.pct || 0) / 100 })
  }
  const secIn = (n) => {
    let s = 0
    for (let i = 0; i < n; i++) s += day(dateKey(addDays(fromKey(today), -i))).sec || 0
    return s
  }
  const next = settings.wirdNext || 1
  const todayDone = day(today).done
  // الجزء اللي إنت فيه في الختمة دي
  const juzDone = todayDone ? (next === 1 ? 30 : next - 1) : next - 1
  const partial = todayDone ? 0 : (settings.wirdPos?.juz === next ? settings.wirdPos.pct || 0 : day(today).pct || 0) / 100
  const khatmaPct = Math.min(1, (juzDone + partial) / 30)
  const daysLeft = Math.max(0, 30 - juzDone - (todayDone ? 0 : 0))
  const finish = dateKey(addDays(fromKey(today), todayDone ? daysLeft : Math.max(0, daysLeft - 1)))
  const curJuz = todayDone ? null : next
  return {
    current,
    best,
    grid,
    minToday: Math.round((day(today).sec || 0) / 60),
    minWeek: Math.round(secIn(7) / 60),
    khatma: (settings.khatmaCount || 0) + 1,
    khatmaCount: settings.khatmaCount || 0,
    juzDone,
    khatmaPct,
    finish,
    pagesToday: curJuz ? Math.round(partial * juzPages(curJuz)) : juzPages(todayDone ? (next === 1 ? 30 : next - 1) : next),
    pagesTotal: juzPages(curJuz || (next === 1 ? 30 : next - 1)),
    todayDone,
  }
}
