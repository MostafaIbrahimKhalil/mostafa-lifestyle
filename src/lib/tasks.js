import { db, setCheck } from '../db.js'

export const TASK_CATS = {
  work: { label: 'شغل', color: 'var(--c-work)' },
  personal: { label: 'شخصي', color: 'var(--c-goals)' },
  home: { label: 'بيت', color: 'var(--c-family)' },
}

export const PRIORITY = {
  1: { label: 'مهم جدًا', cls: 'p1' },
  2: { label: 'مهم', cls: 'p2' },
  3: { label: 'عادي', cls: 'p3' },
}

export const catOf = (t) => t.category || 'work'

// تقسيم المهام لليوم: النهارده، كل يوم، جاية
export function groupTasks(all, today) {
  const daily = all.filter((t) => t.kind === 'daily' && t.active !== false)
  const once = all.filter((t) => t.kind === 'once')
  const todayList = once
    .filter((t) => (t.done ? t.doneDate === today : t.date <= today))
    .sort((a, b) => a.done - b.done || a.priority - b.priority || a.date.localeCompare(b.date) || a.id - b.id)
  const upcoming = once.filter((t) => !t.done && t.date > today).sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority)
  return { daily, today: todayList, upcoming }
}

export async function addTask({ title, kind, category, priority, date }) {
  return db.tasks.add({
    kind,
    title,
    category,
    priority: priority || 2,
    date,
    done: false,
    active: true,
    createdAt: new Date().toISOString(),
  })
}

export async function toggleTask(t, done, today) {
  if (t.kind === 'daily') return setCheck(today, `task:${t.id}`, done)
  return db.tasks.update(t.id, { done, doneDate: done ? today : null, doneAt: done ? new Date().toISOString() : null })
}

export async function removeTask(t) {
  if (t.kind === 'daily' || t.kind === 'monthly') return db.tasks.update(t.id, { active: false })
  return db.tasks.delete(t.id)
}
