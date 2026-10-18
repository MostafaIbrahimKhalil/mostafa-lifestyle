import { PRAYERS } from './prayer.js'
import { addDays, dateKey, fromKey, todayKey } from './dates.js'

// العادة بتتحسب "اتكونت" بعد ٦٦ يوم متتالي
export const FORMED_DAYS = 66

// قوة العادة بطريقة Loop Habit Tracker: كل يوم القوة بتقرب من ١ لو عملتها ومن ٠ لو فوّتها،
// ويوم واحد فايت ما بيهدّش كل اللي بنيته (عكس العدّاد المتتالي)
const DAILY_MULTIPLIER = Math.pow(0.5, 1 / 13)

export function habitDefs(settings, tasks) {
  const defs = [
    ...PRAYERS.map((p) => ({ id: `prayer:${p.id}`, name: `صلاة ${p.name}`, aspect: 'faith', group: 'الصلاة' })),
    { id: 'tasbih', name: 'التسبيح بعد الصلوات', aspect: 'faith', group: 'الأذكار', needs: PRAYERS.map((p) => `tasbih:${p.id}`) },
    { id: 'adhkar:morning', name: 'أذكار الصباح', aspect: 'faith', group: 'الأذكار' },
    { id: 'adhkar:evening', name: 'أذكار المساء', aspect: 'faith', group: 'الأذكار' },
    { id: 'adhkar:sleep', name: 'أذكار النوم', aspect: 'faith', group: 'الأذكار' },
    { id: 'wird', name: 'الورد اليومي', aspect: 'faith', group: 'القرآن' },
  ]
  if (settings.hifzEnabled !== false) defs.push({ id: 'hifz', name: 'الحفظ', aspect: 'faith', group: 'القرآن' })
  defs.push(
    { id: 'teeth:am', name: 'أسنان الصبح', aspect: 'health', group: 'الصحة' },
    { id: 'teeth:pm', name: 'أسنان قبل النوم', aspect: 'health', group: 'الصحة' },
  )
  for (const t of tasks.filter((t) => t.kind === 'daily' && t.active !== false)) {
    defs.push({
      id: `task:${t.id}`,
      name: t.title,
      aspect: 'work',
      group: 'مهام كل يوم',
      start: t.createdAt ? dateKey(new Date(t.createdAt)) : null,
    })
  }
  return defs
}

// يحوّل علامات ✓ لـ: تاريخ ← مجموعة البنود اللي اتعملت
export function indexChecks(checks) {
  const byDate = new Map()
  for (const c of checks) {
    if (c.date.length !== 10) continue // علامات الشهر
    if (!byDate.has(c.date)) byDate.set(c.date, new Set())
    byDate.get(c.date).add(c.item)
  }
  return byDate
}

function isDone(def, set) {
  if (!set) return false
  if (def.needs) return def.needs.every((i) => set.has(i))
  return set.has(def.id)
}

export function habitStats(def, byDate, firstUse, now = new Date()) {
  const today = todayKey(now)
  const startKey = [firstUse || today, def.start || firstUse || today].sort().pop()
  const days = []
  for (let d = fromKey(startKey); dateKey(d) <= today; d = addDays(d, 1)) days.push(dateKey(d))
  const done = days.map((k) => isDone(def, byDate.get(k)))
  const todayDone = done[done.length - 1]

  // العدّاد المتتالي: النهارده لو لسه ما اتعملش ما بيكسرش السلسلة
  let current = 0
  for (let i = done.length - 1 - (todayDone ? 0 : 1); i >= 0 && done[i]; i--) current++

  let best = 0
  let run = 0
  for (const d of done) {
    run = d ? run + 1 : 0
    best = Math.max(best, run)
  }

  // الأيام اللي خلصت (من غير النهارده لو لسه ما اتعملش)
  const closed = todayDone ? done : done.slice(0, -1)
  const rate = (n) => {
    const slice = closed.slice(-n)
    return slice.length ? slice.filter(Boolean).length / slice.length : null
  }

  let score = 0
  for (const d of closed) score = score * DAILY_MULTIPLIER + (d ? 1 - DAILY_MULTIPLIER : 0)
  if (todayDone) score = score * DAILY_MULTIPLIER + (1 - DAILY_MULTIPLIER)

  const last7 = closed.slice(-7)
  const misses7 = last7.filter((d) => !d).length
  const r30 = rate(30)

  let status
  if (current >= FORMED_DAYS) status = 'formed'
  else if (closed.length < 3) status = 'new'
  else if (best >= FORMED_DAYS) status = 'slipped'
  else if ((r30 ?? 0) >= 0.7) status = 'building'
  else status = 'weak'

  return {
    ...def,
    days: closed.length,
    todayDone,
    current,
    best,
    rate7: rate(7),
    rate30: r30,
    misses7,
    window7: last7.length,
    score,
    status,
    toFormed: Math.max(0, FORMED_DAYS - current),
    last14: done.slice(-14),
  }
}

export const STATUS = {
  formed: { label: 'اتكونت ✓', cls: 'st-formed' },
  building: { label: 'بتتكوّن', cls: 'st-building' },
  slipped: { label: 'وقعت، رجّعها', cls: 'st-slipped' },
  weak: { label: 'محتاجة شغل', cls: 'st-weak' },
  new: { label: 'لسه بادئ', cls: 'st-new' },
}
