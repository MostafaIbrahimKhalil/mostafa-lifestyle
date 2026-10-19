// النتيجة: كل شهر لحد آخر السنة، وكل يوم عليه إيه
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from './Icon.jsx'
import QuickAddSheet, { dayName } from './QuickAddSheet.jsx'
import { CheckButton } from './TaskParts.jsx'
import { db } from '../db.js'
import { formatMonth, formatShortDate, formatTime, fromKey, num } from '../lib/dates.js'
import { TYPE_META, agendaFor, loadAgenda, monthCounts } from '../lib/agenda.js'
import { PRIORITY, toggleTask } from '../lib/tasks.js'

const HEAD = ['سبت', 'حد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة']
const hm = (at) => formatTime(new Date(`2000-01-01T${at}`))

export default function Agenda({ today, settings, onOpenDay }) {
  const t0 = fromKey(today)
  const [cur, setCur] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  const [sel, setSel] = useState(today)
  const [adding, setAdding] = useState(false)
  const data = useLiveQuery(loadAgenda, [])
  if (!data) return null

  const counts = monthCounts(cur.y, cur.m, data, today)
  const first = new Date(cur.y, cur.m, 1)
  const lead = (first.getDay() + 1) % 7 // السبت أول عمود
  const n = new Date(cur.y, cur.m + 1, 0).getDate()
  const keys = Array.from({ length: n }, (_, i) => `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
  const items = agendaFor(sel, data, today)
  const yearEnd = new Date(t0.getFullYear(), 11, 31)
  const leftInYear = Math.round((yearEnd - t0) / 86400000)
  const monthOpen = Object.values(counts).reduce((s, c) => s + c.n, 0)

  const move = (d) => {
    const x = new Date(cur.y, cur.m + d, 1)
    setCur({ y: x.getFullYear(), m: x.getMonth() })
  }

  return (
    <>
      <section className="card agenda">
        <div className="agenda-head">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="الشهر اللي فات">
            <Icon name="chevronRight" />
          </button>
          <div className="agenda-title">
            <strong>{formatMonth(cur.y, cur.m)}</strong>
            <small className="muted">
              {monthOpen ? `${num(monthOpen)} حاجة عليك` : 'فاضي'} · فاضل {num(leftInYear)} يوم في السنة
            </small>
          </div>
          <button className="icon-btn" onClick={() => move(1)} aria-label="الشهر اللي جاي">
            <Icon name="chevronLeft" />
          </button>
        </div>
        <div className="agenda-grid" role="grid">
          {HEAD.map((h) => (
            <span key={h} className="agenda-wd">
              {h}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {keys.map((k) => {
            const c = counts[k]
            const cls = [
              'agenda-day',
              k === today && 'is-today',
              k === sel && 'is-sel',
              k < today && 'is-past',
              c.important && 'is-important',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button key={k} className={cls} onClick={() => setSel(k)} aria-label={`${formatShortDate(fromKey(k))}: ${c.n} حاجة`}>
                <span className="agenda-num">{num(Number(k.slice(8)))}</span>
                {c.n > 0 ? <span className="agenda-count">{num(c.n)}</span> : <span className="agenda-count is-empty" />}
              </button>
            )
          })}
        </div>
        <div className="agenda-foot">
          <button className="link-btn" onClick={() => (setCur({ y: t0.getFullYear(), m: t0.getMonth() }), setSel(today))}>
            النهارده
          </button>
          <span className="muted small">
            <span className="agenda-key is-important" /> فيه حاجة مهمة جدًا
          </span>
        </div>
      </section>

      <section className="card agenda-day-card">
        <div className="row-between">
          <h2>{dayName(sel, today)}</h2>
          <button className="link-btn" onClick={() => onOpenDay(sel)}>
            افتح اليوم ده <Icon name="chevronLeft" size={16} />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="muted">مفيش حاجة متسجلة لليوم ده.</p>
        ) : (
          <ul className="tasks agenda-list">
            {items.map((x) => {
              const meta = TYPE_META[x.type]
              return (
                <li key={x.key} className={`task ${x.done ? 'is-done' : ''}`}>
                  {x.type === 'task' ? (
                    <span className={`prio ${PRIORITY[x.prio]?.cls}`} title={PRIORITY[x.prio]?.label} />
                  ) : (
                    <span className="agenda-ico">
                      <Icon name={meta.icon} size={16} />
                    </span>
                  )}
                  <span className="task-title">
                    {x.title}
                    <span className="task-meta">
                      <small>{meta.label}</small>
                      {x.at && <small>{hm(x.at)}</small>}
                      {x.weekly && <small>كل أسبوع</small>}
                      {x.carried && <small className="carried">متأجلة من {formatShortDate(fromKey(x.carried))}</small>}
                    </span>
                  </span>
                  {x.type === 'task' && <CheckButton done={x.done} onToggle={(d) => toggleTask(x.ref, d, sel < today ? sel : today)} label={x.title} />}
                  {x.type === 'reminder' && (
                    <button
                      className="icon-btn"
                      onClick={() => window.confirm(`تمسح التذكير "${x.title}"${x.weekly ? ' (كل أسبوع)' : ''}؟`) && db.reminders.delete(x.ref.id)}
                      aria-label="امسح التذكير"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <button className="btn btn-ghost btn-wide" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> ضيف حاجة {sel === today ? 'للنهارده' : `ليوم ${num(Number(sel.slice(8)))}`}
        </button>
      </section>

      {adding && <QuickAddSheet date={sel} today={today} settings={settings} onClose={() => setAdding(false)} />}
    </>
  )
}
