import { fromKey, minutesBetween } from './dates.js'

export function goalProgress(g) {
  if (g.done) return 1
  const steps = g.steps || []
  return steps.length ? steps.filter((s) => s.done).length / steps.length : 0
}

export function daysLeft(g, now = new Date()) {
  return g.targetDate ? Math.ceil(minutesBetween(now, fromKey(g.targetDate)) / 1440) : null
}
