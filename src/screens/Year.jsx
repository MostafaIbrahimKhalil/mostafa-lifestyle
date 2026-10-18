import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { daysInMonth, formatShortDate, fromKey, logicalDate, minutesBetween, num } from '../lib/dates.js'
import { countedDays, summarize } from '../lib/stats.js'

export default function Year({ settings }) {
  const [year, setYear] = useState(logicalDate().getFullYear())
  const checks = useLiveQuery(
    () => db.checks.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(),
    [year],
  )
  const goals = useLiveQuery(() => db.goals.orderBy('order').toArray(), [])
  if (!checks || !goals) return null

  const months = Array.from({ length: 12 }, (_, m) => {
    const mk = `${year}-${String(m + 1).padStart(2, '0')}`
    const days = countedDays(`${mk}-01`, `${mk}-${String(daysInMonth(year, m)).padStart(2, '0')}`, settings.firstUse)
    return {
      m,
      name: new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(year, m, 1)),
      days: days.length,
      ratio: days.length ? summarize(checks, days, settings).ratio : null,
    }
  })
  const yearDays = countedDays(`${year}-01-01`, `${year}-12-31`, settings.firstUse)
  const yearSum = summarize(checks, yearDays, settings)

  return (
    <>
      <header className="page-head month-head">
        <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="السنة اللي فاتت">
          <Icon name="chevronRight" />
        </button>
        <h1>{num(year).replace(/٬/g, '')}</h1>
        <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="السنة الجاية">
          <Icon name="chevronLeft" />
        </button>
      </header>

      <Goals goals={goals} />

      <section className="card">
        <div className="row-between">
          <h2>التزامك في السنة</h2>
          <span className="big-pct">{yearDays.length ? `${num(Math.round(yearSum.ratio * 100))}٪` : '—'}</span>
        </div>
        <div className="months">
          {months.map((mo) => (
            <div key={mo.m} className={`month-cell ${mo.ratio === null ? 'is-off' : ''}`}>
              <span>{mo.name}</span>
              <span className="bar">
                <span style={{ width: `${(mo.ratio || 0) * 100}%` }} />
              </span>
              <small>{mo.ratio === null ? '—' : `${num(Math.round(mo.ratio * 100))}٪`}</small>
            </div>
          ))}
        </div>
        {yearDays.length > 0 && (
          <p className="muted">
            صلّيت {num(yearSum.cats.prayer || 0)} صلاة، وقريت {num(yearSum.cats.wird || 0)} جزء في {num(yearDays.length)} يوم.
          </p>
        )}
      </section>

      <section className="card soon-card">
        <h2>مناسبات السنة</h2>
        <p className="muted">أعياد الميلاد ومواعيد المدرسة والتطعيمات هتظهر هنا لما قسم المواعيد يشتغل.</p>
      </section>
    </>
  )
}

function Goals({ goals }) {
  const [editing, setEditing] = useState(null)
  const [newTitle, setNewTitle] = useState('')

  async function addGoal(e) {
    e.preventDefault()
    const clean = newTitle.trim()
    if (!clean) return
    await db.goals.add({ title: clean, targetDate: '', note: '', done: false, order: goals.length + 1 })
    setNewTitle('')
  }

  const now = new Date()

  return (
    <section className="card">
      <h2>أهدافي</h2>
      <ul className="goals">
        {goals.map((g) => {
          const days = g.targetDate ? Math.ceil(minutesBetween(now, fromKey(g.targetDate)) / 1440) : null
          const isEdit = editing === g.id
          return (
            <li key={g.id} className={`goal ${g.done ? 'is-done' : ''}`}>
              <div className="goal-top">
                <span className="goal-icon">
                  <Icon name={g.done ? 'check' : 'star'} size={18} />
                </span>
                <div className="tl-text">
                  <strong>{g.title}</strong>
                  <small>
                    {g.done
                      ? 'اتحقق ✓'
                      : g.targetDate
                        ? `${formatShortDate(fromKey(g.targetDate))} · ${days >= 0 ? `باقي ${num(days)} يوم` : 'المعاد عدّى'}`
                        : 'لسه ما حددتش معاد'}
                  </small>
                  {g.note && !isEdit && <small className="goal-note">{g.note}</small>}
                </div>
                <button className="link-btn" onClick={() => setEditing(isEdit ? null : g.id)}>
                  {isEdit ? 'تم' : 'تعديل'}
                </button>
              </div>
              {isEdit && (
                <div className="goal-edit">
                  <label className="field">
                    <span>المعاد</span>
                    <input
                      className="input"
                      type="date"
                      value={g.targetDate || ''}
                      onChange={(e) => db.goals.update(g.id, { targetDate: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>ملاحظة (المستوى، الخطوة الجاية…)</span>
                    <input
                      className="input"
                      defaultValue={g.note}
                      onBlur={(e) => db.goals.update(g.id, { note: e.target.value.trim() })}
                      maxLength={120}
                    />
                  </label>
                  <div className="row">
                    <button className="btn" onClick={() => db.goals.update(g.id, { done: !g.done })}>
                      {g.done ? 'رجّعه لسه' : 'اتحقق ✓'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => window.confirm(`تمسح "${g.title}"؟`) && db.goals.delete(g.id)}
                    >
                      <Icon name="trash" size={18} />
                      امسح
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <form className="row" onSubmit={addGoal}>
        <input
          className="input"
          placeholder="هدف جديد…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={60}
        />
        <button className="btn" type="submit" aria-label="ضيف الهدف">
          <Icon name="plus" size={18} />
        </button>
      </form>
    </section>
  )
}
