import { PRAYERS, prayerTimesFor } from './prayer.js'
import { timeOnDay } from './dates.js'
import { gymTimeFor, isGymDay, routineFor } from './workout.js'

const MIN = 60 * 1000

export const DEFAULT_SLEEP = '00:00'
export const WATER_TARGET = 12 // كوباية ٢٥٠ مل = ٣ لتر
export const MEALS = [
  { id: 'meal:1', name: 'الفطار' },
  { id: 'meal:2', name: 'الغدا' },
  { id: 'meal:3', name: 'العشا' },
]

// البنود الثابتة اللي بتتحسب في نسبة الالتزام (من غير مهام الشغل). day اختياري: عشان أيام الجيم
export function trackedItemIds(settings, day = null) {
  const ids = []
  for (const p of PRAYERS) ids.push(`prayer:${p.id}`, `tasbih:${p.id}`)
  ids.push('adhkar:morning', 'adhkar:evening', 'adhkar:sleep', 'teeth:am', 'teeth:pm', 'wird')
  if (settings.hifzEnabled !== false) ids.push('hifz')
  if (settings.foodEnabled !== false) ids.push(...MEALS.map((m) => m.id), 'water', 'clean')
  if (day && isGymDay(day, settings)) ids.push('gym')
  if (day && day.getDay() === 4 && day >= new Date(2026, 9, 22)) ids.push('nails')
  if (settings.zeinEnabled !== false && (!day || day >= new Date(2026, 9, 19))) ids.push('zein')
  return ids
}

export const ITEM_ASPECT = (item) => {
  if (item.startsWith('teeth') || item.startsWith('meal') || item === 'water' || item === 'clean' || item === 'gym' || item === 'nails')
    return 'health'
  if (item.startsWith('task')) return 'work'
  if (item === 'zein') return 'family'
  return 'faith'
}

// يبني قائمة اليوم مرتّبة بالوقت من الفجر للنوم
export function buildDay(day, settings) {
  const times = prayerTimesFor(day, settings.location || undefined)
  const sleep = timeOnDay(day, settings.sleepTime || DEFAULT_SLEEP)
  const slot = settings.wirdSlot || 'fajr'
  const slotTime = { fajr: times.sunrise, asr: times.asr, isha: times.isha }[slot]
  const rows = []

  for (const p of PRAYERS) {
    rows.push({ type: 'prayer', id: `prayer:${p.id}`, prayer: p.id, title: p.name, time: times[p.id] })
  }

  rows.push({
    type: 'check',
    id: 'teeth:am',
    title: 'غسيل الأسنان',
    subtitle: 'أول ما تصحى',
    icon: 'tooth',
    time: new Date(times.fajr.getTime() + 2 * MIN),
    hideTime: true,
  })
  rows.push({
    type: 'check',
    id: 'adhkar:morning',
    title: 'أذكار الصباح',
    subtitle: 'من بعد الفجر',
    icon: 'sun',
    time: new Date(times.fajr.getTime() + 5 * MIN),
    hideTime: true,
  })
  rows.push({ type: 'wird', id: 'wird', title: 'الورد', icon: 'book', time: new Date(slotTime.getTime() + 10 * MIN) })
  if (settings.hifzEnabled !== false) {
    rows.push({
      type: 'check',
      id: 'hifz',
      title: 'الحفظ',
      subtitle: 'جديد ومراجعة',
      icon: 'book',
      time: new Date(slotTime.getTime() + 11 * MIN),
      hideTime: true,
    })
  }

  // بلوك الشغل بين الشروق والظهر
  rows.push({
    type: 'work',
    id: 'work',
    title: 'الشغل',
    time: new Date(times.sunrise.getTime() + (times.dhuhr - times.sunrise) / 2),
    hideTime: true,
  })

  // الأكل والمية بعد الظهر
  if (settings.foodEnabled !== false) {
    rows.push({ type: 'food', id: 'food', title: 'الأكل والمية', time: new Date(times.dhuhr.getTime() + 30 * MIN), hideTime: true })
  }

  // الجيم في أيامه
  const routine = routineFor(day, settings)
  if (routine) {
    rows.push({
      type: 'gym',
      id: 'gym',
      title: routine.name,
      routine,
      icon: 'dumbbell',
      time: gymTimeFor(day, settings, times),
    })
  }

  rows.push({
    type: 'check',
    id: 'adhkar:evening',
    title: 'أذكار المساء',
    subtitle: 'من بعد العصر',
    icon: 'moon',
    time: new Date(times.asr.getTime() + 5 * MIN),
    hideTime: true,
  })
  rows.push({
    type: 'check',
    id: 'teeth:pm',
    title: 'غسيل الأسنان',
    subtitle: 'قبل النوم',
    icon: 'tooth',
    time: new Date(sleep.getTime() - 15 * MIN),
  })
  // وقت زين: بعد المغرب بربع ساعة، وفكرة نشاط مختلفة كل يوم
  if (settings.zeinEnabled !== false) {
    rows.push({ type: 'zein', id: 'zein', title: 'وقت زين', icon: 'heart', time: new Date(times.maghrib.getTime() + 15 * MIN) })
  }
  // قص الضوافر كل خميس بالليل
  if (day.getDay() === 4) {
    rows.push({ type: 'check', id: 'nails', title: 'قص الضوافر', subtitle: 'كل خميس بالليل', icon: 'scissors', time: timeOnDay(day, '21:00') })
  }
  rows.push({ type: 'check', id: 'adhkar:sleep', title: 'أذكار النوم', icon: 'bed', time: sleep })

  rows.sort((a, b) => a.time - b.time)
  return { rows, times, sleep }
}

// أي صلاة وقتها شغال دلوقتي
export function currentPrayer(times, now) {
  let current = null
  for (const p of PRAYERS) if (now >= times[p.id]) current = p.id
  // الفجر بيخلص مع الشروق
  if (current === 'fajr' && now >= times.sunrise) current = null
  return current
}

// مهام الشغل اللي تظهر في يوم معيّن
export function tasksForDay(allTasks, dateKeyStr) {
  const daily = allTasks.filter((t) => t.kind === 'daily' && t.active !== false && (!t.startDate || t.startDate <= dateKeyStr))
  const once = allTasks
    .filter((t) => t.kind === 'once')
    .filter((t) => (t.done ? t.doneDate === dateKeyStr : t.date <= dateKeyStr))
    .sort((a, b) => (a.done - b.done) || (a.priority - b.priority) || (a.id - b.id))
  return { daily, once }
}

export function progressFor(checkedSet, settings, workTotal, workDone, day = null) {
  const ids = trackedItemIds(settings, day)
  const faith = ids.filter((i) => ITEM_ASPECT(i) === 'faith')
  const health = ids.filter((i) => ITEM_ASPECT(i) === 'health')
  const family = ids.filter((i) => ITEM_ASPECT(i) === 'family')
  const ratio = (arr) => (arr.length ? arr.filter((i) => checkedSet.has(i)).length / arr.length : 0)
  const doneTracked = ids.filter((i) => checkedSet.has(i)).length
  const total = ids.length + workTotal
  return {
    aspects: {
      faith: ratio(faith),
      health: ratio(health),
      family: ratio(family),
      work: workTotal ? workDone / workTotal : 0,
    },
    overall: total ? (doneTracked + workDone) / total : 0,
  }
}
