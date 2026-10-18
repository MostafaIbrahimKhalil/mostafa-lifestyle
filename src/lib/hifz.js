// نظام الحفظ: جديد كل يومين (يوم حفظ ويوم تثبيت)، تسميع في نفس اليوم، ومراجعة بجدول متباعد
import QURAN from '../data/quran-index.json'
import { db, setCheck } from '../db.js'
import { addDays, dateKey, fromKey, todayKey } from './dates.js'

export const SURAH = Object.fromEntries(QURAN.surahs.map((s) => [s.n, s]))
export const LESSON_SIZE = 3
// بعد الحفظ بالأيام: ١ (يوم التثبيت)، ٣، ٧، ١٤، ٣٠، ٦٠، ١٢٠
export const INTERVALS = [1, 3, 7, 14, 30, 60, 120]

// ترتيب الحفظ: من الناس وطالع، سورة سورة، وكل سورة مقسومة ٣ آيات (من غير ما الدرس يعدّي السورة)
function buildPlan() {
  const plan = []
  for (let n = 114; n >= 1; n--) {
    const total = SURAH[n].ayahs
    let a = 1
    while (a <= total) {
      let to = Math.min(total, a + LESSON_SIZE - 1)
      // لو هيفضل آية واحدة لوحدها في الآخر نضمها للدرس ده
      if (total - to === 1) to = total
      plan.push({ id: plan.length + 1, surah: n, from: a, to })
      a = to + 1
    }
  }
  return plan
}
export const PLAN = buildPlan()

export function lessonTitle(l) {
  const s = SURAH[l.surah]
  if (l.from === 1 && l.to === s.ayahs) return `سورة ${s.name} كاملة`
  return `${s.name} ${l.from.toLocaleString('ar-EG')}–${l.to.toLocaleString('ar-EG')}`
}

export function juzOf(s, a) {
  let j = 1
  for (const x of QURAN.juzs) {
    const [ss, aa] = x.start
    if (s > ss || (s === ss && a >= aa)) j = x.juz
    else break
  }
  return j
}

// حالة النهارده: يوم حفظ جديد، ولا تثبيت، ولا خلّصت
export function todayPlan(rows, pace = 'everyOther', today = todayKey()) {
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
  const memorized = rows.filter((r) => r.memorizedAt).sort((a, b) => a.id - b.id)
  const last = memorized.at(-1)
  const yesterday = dateKey(addDays(fromKey(today), -1))
  const nextLesson = PLAN.find((p) => !byId[p.id]?.memorizedAt)

  let mode = 'new'
  let lesson = nextLesson
  if (last?.memorizedAt === today) {
    mode = 'doneToday'
    lesson = last
  } else if (pace === 'everyOther' && last && last.memorizedAt === yesterday) {
    mode = last.steadyAt === today ? 'steadyDone' : 'steady'
    lesson = last
  } else if (pace === 'everyOther' && last?.steadyAt === today) {
    mode = 'steadyDone'
    lesson = last
  }

  const due = rows
    .filter((r) => r.memorizedAt && r.nextReview && r.nextReview <= today && r.id !== lesson?.id)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.id - b.id)
  const reviewedToday = rows.filter((r) => (r.reviews || []).some((v) => v.date === today) && r.id !== lesson?.id)

  return { mode, lesson: lesson && { ...PLAN[lesson.id - 1], ...(byId[lesson.id] || {}) }, due, reviewedToday }
}

export function summary(rows) {
  const done = rows.filter((r) => r.memorizedAt)
  const ayahs = done.reduce((s, r) => s + (r.to - r.from + 1), 0)
  const fullSurahs = new Set()
  for (const n of new Set(done.map((r) => r.surah))) {
    const lessons = PLAN.filter((p) => p.surah === n)
    if (lessons.every((p) => done.some((d) => d.id === p.id))) fullSurahs.add(n)
  }
  const strong = done.filter((r) => (r.intervalIdx || 0) >= 3).length
  return { ayahs, ratio: ayahs / QURAN.totalAyahs, surahs: fullSurahs.size, lessons: done.length, strong }
}

// ===== الأفعال =====

export async function startLesson(l, today = todayKey()) {
  const ex = await db.hifzLessons.get(l.id)
  if (!ex) await db.hifzLessons.put({ id: l.id, surah: l.surah, from: l.from, to: l.to, startedAt: today, reps: 0, sameDay: [], reviews: [] })
}

export async function bumpReps(l, n = 1) {
  await db.transaction('rw', db.hifzLessons, async () => {
    const r = await db.hifzLessons.get(l.id)
    await db.hifzLessons.update(l.id, { reps: Math.max(0, (r?.reps || 0) + n) })
  })
}

export async function toggleSameDay(l, step) {
  await db.transaction('rw', db.hifzLessons, async () => {
    const r = await db.hifzLessons.get(l.id)
    const cur = new Set(r?.sameDay || [])
    if (cur.has(step)) cur.delete(step)
    else cur.add(step)
    await db.hifzLessons.update(l.id, { sameDay: [...cur] })
  })
}

export async function markMemorized(l, today = todayKey()) {
  await startLesson(l, today)
  await db.hifzLessons.update(l.id, {
    memorizedAt: today,
    intervalIdx: 0,
    nextReview: dateKey(addDays(fromKey(today), INTERVALS[0])),
  })
}

export async function markSteady(l, today = todayKey()) {
  const r = await db.hifzLessons.get(l.id)
  await db.hifzLessons.update(l.id, {
    steadyAt: today,
    reviews: [...(r.reviews || []), { date: today, ok: true }],
    intervalIdx: 1,
    nextReview: dateKey(addDays(fromKey(today), INTERVALS[1])),
  })
}

// تسميع مراجعة: صح ← يبعد للمرحلة اللي بعدها، غلطات ← يرجع بكرة ومرحلة لورا
export async function review(l, ok, today = todayKey()) {
  const r = await db.hifzLessons.get(l.id)
  const idx = r.intervalIdx || 0
  const nextIdx = ok ? Math.min(INTERVALS.length - 1, idx + 1) : Math.max(0, idx - 1)
  await db.hifzLessons.update(l.id, {
    reviews: [...(r.reviews || []), { date: today, ok }],
    intervalIdx: nextIdx,
    nextReview: dateKey(addDays(fromKey(today), ok ? INTERVALS[nextIdx] : 1)),
  })
}

// علامة "الحفظ" في جدول اليوم بتتعلّم لوحدها لما الجديد/التثبيت والتسميع يخلصوا
export async function syncHifzCheck(today = todayKey(), pace = 'everyOther') {
  const rows = await db.hifzLessons.toArray()
  const p = todayPlan(rows, pace, today)
  const mainDone = p.mode === 'doneToday' || p.mode === 'steadyDone'
  await setCheck(today, 'hifz', mainDone && p.due.length === 0)
}

export const STEPS = [
  { id: 'read', title: 'اقرأها من المصحف ٥ مرات', sub: 'بتركيز، وبصوت مسموع، واسمعها من قارئ لو تحب' },
  { id: 'each', title: 'كرر كل آية لوحدها ١٠ مرات', sub: 'وإنت بتبص، وبعدين من غير ما تبص' },
  { id: 'link', title: 'اربط الآيات ببعض', sub: 'اقرأ الـ ٣ آيات مع بعض لحد ٢٠ مرة' },
  { id: 'recite', title: 'سمّعها من غير ما تبص', sub: 'النص هيستخبى — لو غلطت ارجع للخطوة اللي قبلها' },
]

export const SAME_DAY = [
  { id: 'r1', title: 'تسميع بعد ساعة', sub: '٥ مرات' },
  { id: 'r2', title: 'تسميع بعد الظهر أو العصر', sub: '٣ مرات، أو صلّي بيها' },
  { id: 'r3', title: 'تسميع قبل النوم', sub: 'مرة أو مرتين' },
]
