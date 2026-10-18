import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setCheck } from '../db.js'
import { daysInMonth, formatMonth, fromKey, logicalDate, monthKey, num, todayKey, WEEK_START } from '../lib/dates.js'
import { countedDays, summarize } from '../lib/stats.js'

const WEEKDAYS = ['سبت', 'أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة']

export default function Month({ settings }) {
  const base = logicalDate()
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() })
  const mk = monthKey(new Date(cursor.y, cursor.m, 1))
  const nDays = daysInMonth(cursor.y, cursor.m)
  const first = `${mk}-01`
  const last = `${mk}-${String(nDays).padStart(2, '0')}`
  const today = todayKey()

  const checks = useLiveQuery(() => db.checks.where('date').between(first, last, true, true).toArray(), [first, last])
  const monthChecks = useLiveQuery(() => db.checks.where('date').equals(mk).toArray(), [mk])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const [selected, setSelected] = useState(null)

  if (!checks || !tasks || !monthChecks) return null

  const days = countedDays(first, last, settings.firstUse)
  const s = summarize(checks, days, settings)
  const counted = new Set(days)

  // شبكة الأيام — الأسبوع بيبدأ السبت
  const lead = (new Date(cursor.y, cursor.m, 1).getDay() - WEEK_START + 7) % 7
  const cells = [...Array(lead).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)]

  const workDone = tasks.filter((t) => t.kind === 'once' && t.done && t.doneDate?.startsWith(mk)).length +
    checks.filter((c) => c.item.startsWith('task:')).length

  const monthly = tasks.filter((t) => t.kind === 'monthly' && t.active !== false)
  const monthlyDone = new Set(monthChecks.map((c) => c.item))

  const go = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(null)
  }

  const selKey = selected ? `${mk}-${String(selected).padStart(2, '0')}` : null
  const selChecks = selKey ? checks.filter((c) => c.date === selKey) : []

  return (
    <>
      <header className="page-head month-head">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="الشهر اللي فات">
          <Icon name="chevronRight" />
        </button>
        <h1>{formatMonth(cursor.y, cursor.m)}</h1>
        <button className="icon-btn" onClick={() => go(1)} aria-label="الشهر الجاي">
          <Icon name="chevronLeft" />
        </button>
      </header>

      <section className="card">
        <div className="row-between">
          <h2>التزامك في الشهر</h2>
          <span className="big-pct">{num(Math.round(s.ratio * 100))}٪</span>
        </div>
        <div className="cal">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-head">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />
            const key = `${mk}-${String(d).padStart(2, '0')}`
            const has = counted.has(key)
            const r = has ? (s.perDay[key] || 0) / s.perDayTotal : null
            return (
              <button
                key={key}
                className={`cal-day ${key === today ? 'is-today' : ''} ${selected === d ? 'is-sel' : ''} ${has ? '' : 'is-off'}`}
                style={r !== null ? { '--fill': r } : undefined}
                onClick={() => has && setSelected(selected === d ? null : d)}
              >
                {num(d)}
              </button>
            )
          })}
        </div>
        {selKey && (
          <p className="muted">
            {new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(selKey))}
            : {num(selChecks.filter((c) => c.item.startsWith('prayer')).length)} من ٥ صلوات ·{' '}
            {num(selChecks.filter((c) => c.item.startsWith('teeth')).length)} من ٢ أسنان
          </p>
        )}
        <div className="cal-legend">
          <span>أقل</span>
          {[0.15, 0.4, 0.7, 1].map((v) => (
            <span key={v} className="cal-swatch" style={{ '--fill': v }} />
          ))}
          <span>أكتر</span>
        </div>
      </section>

      <section className="card">
        <h2>بالتفصيل</h2>
        {s.days === 0 ? (
          <p className="muted">لسه مفيش أيام في الشهر ده.</p>
        ) : (
          <ul className="bars">
            {s.categories.map((c) => (
              <li key={c.id}>
                <div className="row-between">
                  <span>{c.name}</span>
                  <span className="muted">
                    {num(c.done)} من {num(c.expected)}
                  </span>
                </div>
                <span className="bar">
                  <span style={{ width: `${c.expected ? (c.done / c.expected) * 100 : 0}%` }} />
                </span>
              </li>
            ))}
            <li>
              <div className="row-between">
                <span>مهام شغل خلصت</span>
                <strong>{num(workDone)}</strong>
              </div>
            </li>
          </ul>
        )}
      </section>

      <MonthlyTasks mk={mk} monthly={monthly} done={monthlyDone} />

      <section className="card soon-card">
        <h2>المناسبات</h2>
        <p className="muted">أعياد الميلاد ومواعيد المدرسة والتطعيمات هتظهر هنا لما قسم المواعيد يشتغل.</p>
      </section>
    </>
  )
}

function MonthlyTasks({ mk, monthly, done }) {
  const [title, setTitle] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('')
  const [adding, setAdding] = useState(false)

  async function add(e) {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    await db.tasks.add({
      kind: 'monthly',
      title: clean,
      dayOfMonth: dayOfMonth ? Number(dayOfMonth) : null,
      active: true,
      createdAt: new Date().toISOString(),
    })
    setTitle('')
    setDayOfMonth('')
    setAdding(false)
  }

  async function remove(t) {
    if (window.confirm(`تشيل "${t.title}" من مهام كل شهر؟`)) await db.tasks.update(t.id, { active: false })
  }

  const sorted = [...monthly].sort((a, b) => (a.dayOfMonth || 99) - (b.dayOfMonth || 99))

  return (
    <section className="card">
      <div className="row-between">
        <h2>مهام كل شهر</h2>
        <span className="pill">
          {num(sorted.filter((t) => done.has(`mtask:${t.id}`)).length)} من {num(sorted.length)}
        </span>
      </div>
      {sorted.length === 0 && !adding && (
        <p className="muted">زي الفواتير، مصاريف المدرسة، أو أي حاجة بتتعمل مرة في الشهر.</p>
      )}
      <ul className="tasks">
        {sorted.map((t) => {
          const isDone = done.has(`mtask:${t.id}`)
          return (
            <li key={t.id} className={`task ${isDone ? 'is-done' : ''}`}>
              <span className="task-title">
                {t.title}
                {t.dayOfMonth && <small className="carried">يوم {num(t.dayOfMonth)}</small>}
              </span>
              <button className="icon-btn" onClick={() => remove(t)} aria-label="شيل المهمة">
                <Icon name="trash" size={17} />
              </button>
              <button
                className={`check ${isDone ? 'is-done' : ''}`}
                onClick={() => setCheck(mk, `mtask:${t.id}`, !isDone)}
                aria-pressed={isDone}
                aria-label={t.title}
              >
                <Icon name="check" size={18} stroke={2.6} />
              </button>
            </li>
          )
        })}
      </ul>
      {adding ? (
        <form className="add-task" onSubmit={add}>
          <input
            className="input"
            placeholder="المهمة…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={80}
          />
          <label className="field">
            <span>يوم كام في الشهر؟ (اختياري)</span>
            <input
              className="input input-small"
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </label>
          <div className="row">
            <button className="btn" type="submit">
              ضيف
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setAdding(false)}>
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost btn-wide" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          ضيف مهمة شهرية
        </button>
      )}
    </section>
  )
}
