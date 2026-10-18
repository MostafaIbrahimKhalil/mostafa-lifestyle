import { trackedItemIds } from './day.js'
import { addDays, dateKey, fromKey, todayKey } from './dates.js'

export const CATEGORIES = [
  { id: 'prayer', name: 'الصلاة' },
  { id: 'tasbih', name: 'التسبيح بعد الصلاة' },
  { id: 'adhkar', name: 'الأذكار' },
  { id: 'wird', name: 'الورد' },
  { id: 'hifz', name: 'الحفظ' },
  { id: 'teeth', name: 'الأسنان' },
  { id: 'gym', name: 'الجيم' },
  { id: 'meal', name: 'وجبات على الطبق' },
  { id: 'water', name: 'المية' },
  { id: 'clean', name: 'يوم من غير حاجات تزوّد' },
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
  // كل يوم ليه البنود بتاعته (أيام الجيم مختلفة)
  const trackedByDay = new Map(days.map((k) => [k, new Set(trackedItemIds(settings, fromKey(k)))]))
  const perDay = {}
  const perDayTotals = {}
  const cats = {}
  const expected = {}
  for (const c of CATEGORIES) {
    cats[c.id] = 0
    expected[c.id] = 0
  }
  for (const [k, set] of trackedByDay) {
    perDayTotals[k] = set.size
    for (const item of set) expected[catOf(item)] = (expected[catOf(item)] || 0) + 1
  }
  for (const c of checks) {
    const set = trackedByDay.get(c.date)
    if (!set || !set.has(c.item)) continue
    perDay[c.date] = (perDay[c.date] || 0) + 1
    cats[catOf(c.item)] = (cats[catOf(c.item)] || 0) + 1
  }
  const doneAll = Object.values(perDay).reduce((s, n) => s + n, 0)
  const expectedAll = Object.values(perDayTotals).reduce((s, n) => s + n, 0)
  return {
    days: days.length,
    perDay, // date -> عدد البنود اللي اتعملت
    perDayTotals,
    perDayTotal: days.length ? Math.round(expectedAll / days.length) : 0,
    cats,
    ratio: expectedAll ? doneAll / expectedAll : 0,
    categories: CATEGORIES.filter((c) => expected[c.id] > 0).map((c) => ({
      ...c,
      done: cats[c.id] || 0,
      expected: expected[c.id],
    })),
  }
}
