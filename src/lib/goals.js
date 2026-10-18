import { fromKey, minutesBetween } from './dates.js'

export const GOAL_STATUS = { active: 'شغال فيه', paused: 'متوقف', done: 'خلص ✓' }

export function goalProgress(g) {
  if (g.done || g.status === 'done') return 1
  const steps = g.steps || []
  return steps.length ? steps.filter((s) => s.done).length / steps.length : 0
}

export function daysLeft(g, now = new Date()) {
  return g.targetDate ? Math.ceil(minutesBetween(now, fromKey(g.targetDate)) / 1440) : null
}

// الترتيب: الشغالة بالأولوية والأقرب معادًا، وبعدين المتوقفة، وبعدين اللي خلصت
export function sortGoals(goals) {
  const rank = { active: 0, paused: 1, done: 2 }
  return [...goals].sort((a, b) => {
    const sa = a.status || (a.done ? 'done' : 'active')
    const sb = b.status || (b.done ? 'done' : 'active')
    return (
      rank[sa] - rank[sb] ||
      (a.priority || 2) - (b.priority || 2) ||
      (a.targetDate || '9999').localeCompare(b.targetDate || '9999') ||
      a.order - b.order
    )
  })
}
