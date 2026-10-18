import { trackedItemIds } from './day.js'
import { addDays, dateKey, fromKey, todayKey } from './dates.js'

export const CATEGORIES = [
  { id: 'prayer', name: 'الصلاة', perDay: 5 },
  { id: 'tasbih', name: 'التسبيح بعد الصلاة', perDay: 5 },
  { id: 'adhkar', name: 'الأذكار', perDay: 3 },
  { id: 'teeth', name: 'الأسنان', perDay: 2 },
  { id: 'wird', name: 'الورد', perDay: 1 },
  { id: 'hifz', name: 'الحفظ', perDay: 1 },
]

const catOf = (item) => item.split(':')[0]

// الأيام اللي تتحسب: من أول يوم استخدام لحد النهارده بس
export function countedDays(fromKeyStr, toKeyStr, firstUse) {
  const today = todayKey()
  const start = firstUse && firstUse > fromKeyStr ? firstUse : fromKeyStr
  const end = toKeyStr < today ? toKeyStr : today
  const days = []
  if (start > end) return days
  for (let d = fromKey(start); dateKey(d) <= end; d = addDays(d, 1)) days.push(dateKey(d))
  return days
}

export function summarize(checks, days, settings) {
  const tracked = new Set(trackedItemIds(settings))
  const dayset = new Set(days)
  const perDay = {}
  const cats = {}
  for (const c of CATEGORIES) cats[c.id] = 0
  for (const c of checks) {
    if (!dayset.has(c.date) || !tracked.has(c.item)) continue
    perDay[c.date] = (perDay[c.date] || 0) + 1
    cats[catOf(c.item)] = (cats[catOf(c.item)] || 0) + 1
  }
  const perDayTotal = tracked.size
  const doneAll = Object.values(perDay).reduce((s, n) => s + n, 0)
  const expected = days.length * perDayTotal
  return {
    days: days.length,
    perDay, // date -> عدد البنود اللي اتعملت
    perDayTotal,
    cats,
    ratio: expected ? doneAll / expected : 0,
    categories: CATEGORIES.filter((c) => c.id !== 'hifz' || settings.hifzEnabled !== false).map((c) => ({
      ...c,
      done: cats[c.id] || 0,
      expected: days.length * c.perDay,
    })),
  }
}
