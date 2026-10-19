// أرقام الرسومات في "تقدّمي": كل يوم في الفترة، واتعمل فيه قد إيه
import { addDays, dateKey, fromKey } from './dates.js'
import { ITEM_ASPECT, WATER_TARGET, trackedItemIds } from './day.js'
import { PRAYERS } from './prayer.js'
import { groupTasks } from './tasks.js'

export const CHART_ASPECTS = ['faith', 'health', 'work', 'family']

// الأيام من الأقدم للأحدث، وآخر يوم هو النهارده
export function periodDays(today, n) {
  const t = fromKey(today)
  return Array.from({ length: n }, (_, i) => addDays(t, i - n + 1))
}

function byDateIndex(checks) {
  const m = new Map()
  for (const c of checks) {
    if (!c.date || c.date.length !== 10) continue
    let d = m.get(c.date)
    if (!d) m.set(c.date, (d = new Map()))
    d.set(c.item, c)
  }
  return m
}

// نسبة كل جانب في كل يوم. null = اليوم ده قبل ما تبدأ أو مافيهوش حاجة للجانب ده
export function dailyScores(checks, tasks, settings, today, n) {
  const idx = byDateIndex(checks)
  const first = settings.firstUse || today
  return periodDays(today, n).map((day) => {
    const k = dateKey(day)
    const row = { k, day, isToday: k === today }
    if (k < first) return { ...row, before: true, overall: null, ...Object.fromEntries(CHART_ASPECTS.map((a) => [a, null])) }
    const set = idx.get(k) || new Map()
    const excused = set.has('day:excused')
    const ids = trackedItemIds(settings, day)
    let done = 0
    let total = 0
    for (const a of ['faith', 'health', 'family']) {
      const list = ids.filter((i) => ITEM_ASPECT(i) === a)
      const d = list.filter((i) => set.has(i)).length
      row[a] = list.length ? d / list.length : null
      done += d
      total += list.length
    }
    const g = groupTasks(tasks, k)
    const wTotal = g.daily.length + g.today.length
    const wDone = g.daily.filter((t) => set.has(`task:${t.id}`)).length + g.today.filter((t) => t.done).length
    row.work = wTotal ? wDone / wTotal : null
    done += wDone
    total += wTotal
    row.overall = total ? done / total : null
    row.excused = excused
    return row
  })
}

const mean = (vals) => {
  const v = vals.filter((x) => x !== null && x !== undefined)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

// متوسط الفترة. النهارده لسه ما خلصش، فما بيتحسبش إلا لو هو اليوم الوحيد
export function periodAverage(rows) {
  const full = rows.filter((r) => !r.isToday && !r.before && !r.excused)
  const use = full.length ? full : rows.filter((r) => !r.before)
  const out = { days: full.length }
  for (const a of [...CHART_ASPECTS, 'overall']) out[a] = mean(use.map((r) => r[a]))
  return out
}

// الصلوات: في المسجد / في وقتها / متأخرة / قضاء / فاتت
export const PRAYER_KINDS = [
  { id: 'mosque', name: 'في المسجد' },
  { id: 'ontime', name: 'في وقتها' },
  { id: 'late', name: 'متأخرة' },
  { id: 'qada', name: 'قضاء' },
  { id: 'missed', name: 'ما اتسجلتش' },
]

export function prayerBreakdown(checks, settings, today, n) {
  const idx = byDateIndex(checks)
  const first = settings.firstUse || today
  const days = periodDays(today, n)
    .map(dateKey)
    .filter((k) => k >= first)
  return PRAYERS.map((p) => {
    const c = { mosque: 0, ontime: 0, late: 0, qada: 0, missed: 0 }
    let total = 0
    for (const k of days) {
      const v = idx.get(k)?.get(`prayer:${p.id}`)
      if (v) {
        c[v.value === 'mosque' || v.value === 'late' || v.value === 'qada' ? v.value : 'ontime']++
        total++
      } else if (k !== today && !idx.get(k)?.has('day:excused')) {
        c.missed++
        total++
      }
    }
    return { id: p.id, name: p.name, total, ...c }
  })
}

// قيمة لكل يوم من حاجة متسجلة في checks
export function dailyValues(checks, today, n, fn) {
  const idx = byDateIndex(checks)
  return periodDays(today, n).map((day) => {
    const k = dateKey(day)
    return { k, day, isToday: k === today, ...fn(idx.get(k) || new Map(), k) }
  })
}

export const waterDays = (checks, today, n) =>
  dailyValues(checks, today, n, (s) => {
    const v = Number(s.get('water:count')?.value) || 0
    return { v, target: WATER_TARGET, good: v >= WATER_TARGET }
  })

export const quranDays = (checks, today, n) =>
  dailyValues(checks, today, n, (s) => ({
    v: Math.round((Number(s.get('quran:sec')?.value) || 0) / 60),
    good: s.has('wird'),
    pct: Number(s.get('wird:pct')?.value) || 0,
  }))

export function gymDays(workouts, today, n, measure = 'kcal') {
  const by = new Map()
  for (const w of workouts) by.set(w.date, [...(by.get(w.date) || []), w])
  return periodDays(today, n).map((day) => {
    const k = dateKey(day)
    const ws = by.get(k) || []
    const cardio = ws.filter((w) => w.cardio?.done)
    const kcal = cardio.reduce((s, w) => s + (Number(w.cardio.kcal) || 0), 0)
    const min = cardio.reduce((s, w) => s + (Number(w.cardio.minutes) || 0), 0)
    const strength = ws.some((w) => Object.values(w.sets || {}).some((sets) => sets.some((x) => x.done)))
    return { k, day, isToday: k === today, v: measure === 'kcal' ? kcal : min, kcal, min, strength }
  })
}

export function spendDays(txns, today, n) {
  const by = new Map()
  for (const t of txns) if (t.type === 'expense') by.set(t.date, (by.get(t.date) || 0) + (Number(t.amount) || 0))
  return periodDays(today, n).map((day) => {
    const k = dateKey(day)
    return { k, day, isToday: k === today, v: by.get(k) || 0 }
  })
}

export function spendByCategory(txns, today, n) {
  const from = dateKey(addDays(fromKey(today), -n + 1))
  const m = {}
  for (const t of txns) {
    if (t.type !== 'expense' || t.date < from || t.date > today) continue
    const c = t.category || 'تانية'
    m[c] = (m[c] || 0) + (Number(t.amount) || 0)
  }
  return Object.entries(m)
    .map(([name, v]) => ({ name, v }))
    .sort((a, b) => b.v - a.v)
}

// رقم "حلو" لأعلى المحور
export function niceMax(v, min = 1) {
  const m = Math.max(v, min)
  const p = 10 ** Math.floor(Math.log10(m))
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= m) return s * p
  return 10 * p
}
