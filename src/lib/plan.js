// إضافة خطة أكتوبر ونوفمبر للتطبيق — مرة واحدة بس
import { db, getSetting, setSetting } from '../db.js'
import { DW_NOTE, DW_STEPS, GERMAN_WORDS_TASKS, PLAN_APPTS, PLAN_DAILY, PLAN_GOALS, PLAN_POSTS, PLAN_TASKS } from '../data/plan2026.js'

const stepsOf = (titles) => titles.map((title, i) => ({ id: Date.now() + i + Math.random(), title, done: false }))

export async function seedPlan() {
  await seedOnce('seededGermanWords', () =>
    db.tasks.bulkAdd(GERMAN_WORDS_TASKS.map((t) => ({ kind: 'once', done: false, active: true, createdAt: new Date().toISOString(), plan: 'german-words', ...t }))),
  )
  if (await getSetting('seededPlan2026', false)) return
  const now = new Date().toISOString()
  await db.transaction('rw', [db.tasks, db.goals, db.posts, db.appts, db.settings], async () => {
    if (await getSetting('seededPlan2026', false)) return
    await db.tasks.bulkAdd(
      PLAN_TASKS.map((t) => ({ kind: 'once', done: false, active: true, createdAt: now, plan: '2026-q4', ...t })),
    )
    await db.tasks.bulkAdd(
      PLAN_DAILY.map((t) => ({ kind: 'daily', priority: 2, done: false, active: true, createdAt: now, plan: '2026-q4', ...t })),
    )
    const goals = await db.goals.toArray()
    let order = goals.length
    for (const g of PLAN_GOALS) {
      if (goals.some((x) => x.title === g.title)) continue
      await db.goals.add({ ...g, steps: stepsOf(g.steps), done: false, status: 'active', order: ++order })
    }
    // منحة DW: نحط المحطات في الهدف الموجود لو لسه فاضي
    const dw = goals.find((x) => /DW/.test(x.title))
    if (dw && !(dw.steps || []).length) {
      await db.goals.update(dw.id, { steps: stepsOf(DW_STEPS), targetDate: dw.targetDate || '2027-10-31', note: dw.note || DW_NOTE })
    }
    for (const g of goals.filter((x) => /Goethe|IELTS/.test(x.title) && !x.targetDate)) {
      await db.goals.update(g.id, { targetDate: '2027-09-30' })
    }
    if ((await db.posts.count()) === 0)
      await db.posts.bulkAdd(PLAN_POSTS.map((p) => ({ caption: '', edited: false, scheduled: false, published: false, ...p })))
    if ((await db.appts.count()) === 0) await db.appts.bulkAdd(PLAN_APPTS.map((a) => ({ done: false, ...a })))
    await setSetting('seededPlan2026', true)
  })
}

async function seedOnce(key, fn) {
  await db.transaction('rw', [db.tasks, db.settings], async () => {
    if (await getSetting(key, false)) return
    await fn()
    await setSetting(key, true)
  })
}

// حالة الفيديو: اتعدّل ← اتجدول ← نزل
export function postStage(p, today = '') {
  if (p.published || (p.scheduled && today && p.date < today)) return { label: 'نزل ✓', cls: 'pill-ok' }
  if (p.published) return { label: 'نزل ✓', cls: 'pill-ok' }
  if (p.scheduled) return { label: 'متجدول', cls: 'st-building' }
  if (p.edited) return { label: 'اتعدّل، لسه ما اتجدولش', cls: 'st-slipped' }
  return { label: 'لسه ما اتعدّلش', cls: 'st-weak' }
}
