import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { daysInMonth, logicalDate, num } from '../lib/dates.js'
import { countedDays, summarize } from '../lib/stats.js'

export default function Year({ settings }) {
  const [year, setYear] = useState(logicalDate().getFullYear())
  const checks = useLiveQuery(
    () => db.checks.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(),
    [year],
  )
  if (!checks) return null

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
