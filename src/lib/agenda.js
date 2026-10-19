// الأجندة: كل اللي عليك في يوم معيّن (مهام، تذكيرات، فيديوهات، مواعيد، أهداف، فواتير)
import { db } from '../db.js'
import { monthKey } from './dates.js'
import { obligationsFor } from './wallet.js'

export async function loadAgenda() {
  const [tasks, reminders, posts, appts, goals, obligations, txns] = await Promise.all([
    db.tasks.toArray(),
    db.reminders.toArray(),
    db.posts.toArray(),
    db.appts.toArray(),
    db.goals.toArray(),
    db.obligations.toArray(),
    db.txns.toArray(),
  ])
  return { tasks, reminders, posts, appts, goals, obligations, txns }
}

const PRIO_ORDER = (x) => (x.prio ?? 2) * 10 + (x.at ? 0 : 5)

/**
 * k: مفتاح اليوم، today: النهارده.
 * النهارده بيظهر فيه كمان المهام اللي اتأخرت ولسه ما خلصتش (اتنقلت لوحدها)
 */
export function agendaFor(k, data, today) {
  const out = []
  const wd = new Date(`${k}T12:00`).getDay()
  for (const t of data.tasks) {
    if (t.kind !== 'once' || t.active === false) continue
    const carried = k === today && !t.done && t.date < today
    // المهمة اللي ما خلصتش في يوم فات اتنقلت للنهارده، فما بتتعدّش في يومها القديم
    const own = t.date === k && (t.done || k >= today)
    if (own || carried || (t.done && t.doneDate === k && t.date !== k)) {
      out.push({ key: `t${t.id}`, type: 'task', title: t.title, at: t.at, prio: t.priority, done: !!t.done, carried: carried ? t.date : null, ref: t })
    }
  }
  for (const r of data.reminders) {
    if (r.active === false) continue
    if (r.date === k || (!r.date && r.weekday === wd)) out.push({ key: `r${r.id}`, type: 'reminder', title: r.title, at: r.at, weekly: !r.date, prio: 2, ref: r })
  }
  for (const p of data.posts) if (p.date === k) out.push({ key: `p${p.id}`, type: 'post', title: `فيديو: ${p.title}`, prio: 1, done: !!p.published, ref: p })
  for (const a of data.appts) if (a.date === k) out.push({ key: `a${a.id}`, type: 'appt', title: a.title, at: a.time, prio: 1, done: !!a.done, ref: a })
  for (const g of data.goals)
    if (g.targetDate === k && !g.done && g.status !== 'done') out.push({ key: `g${g.id}`, type: 'goal', title: `آخر معاد: ${g.title}`, prio: 1, ref: g })
  const mk = k.slice(0, 7)
  for (const o of obligationsFor(mk, data.obligations.filter((o) => o.dueDay), data.txns))
    if (o.due === k) out.push({ key: `o${o.id}`, type: 'bill', title: o.name, prio: 2, done: o.paid, ref: o })
  return out.sort((a, b) => a.done - b.done || PRIO_ORDER(a) - PRIO_ORDER(b) || (a.at || '').localeCompare(b.at || ''))
}

// عدد الحاجات في كل يوم من الشهر (للنقط في النتيجة)
export function monthCounts(y, m, data, today) {
  const n = new Date(y, m + 1, 0).getDate()
  const mk = monthKey(new Date(y, m, 1))
  const out = {}
  for (let d = 1; d <= n; d++) {
    const k = `${mk}-${String(d).padStart(2, '0')}`
    const items = agendaFor(k, data, today)
    out[k] = { n: items.filter((x) => !x.done).length, important: items.some((x) => !x.done && x.prio === 1), all: items.length }
  }
  return out
}

export const TYPE_META = {
  task: { icon: 'list', label: 'مهمة' },
  reminder: { icon: 'bell', label: 'تذكير' },
  post: { icon: 'calendar', label: 'فيديو' },
  appt: { icon: 'heart', label: 'معاد' },
  goal: { icon: 'flag', label: 'هدف' },
  bill: { icon: 'wallet', label: 'فاتورة' },
}
