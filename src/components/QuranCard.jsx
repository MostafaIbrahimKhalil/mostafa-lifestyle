import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { addDays, dateKey, formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { quranStats } from '../lib/quranStats.js'

// الورد: الختمة فين، والسلسلة، ووقت القراية، وشبكة آخر ٤ أسابيع
export default function QuranCard({ settings }) {
  const today = todayKey()
  const from = dateKey(addDays(fromKey(today), -400))
  const checks = useLiveQuery(() => db.checks.where('date').aboveOrEqual(from).toArray(), [from])
  if (!checks) return null
  const s = quranStats(checks, settings, today)
  return (
    <section className="card quran-card">
      <div className="row-between">
        <h2>الورد والختمة</h2>
        {s.khatmaCount > 0 && <span className="pill pill-ok">ختمت {num(s.khatmaCount)} مرة</span>}
      </div>
      <div className="row-between">
        <span>
          الختمة رقم {num(s.khatma)}: <strong>{num(s.juzDone)} من ٣٠ جزء</strong>
        </span>
        <strong className="pos">{num(Math.round(s.khatmaPct * 100))}٪</strong>
      </div>
      <span className="bar" style={{ '--bar': 'var(--c-faith)' }}>
        <span style={{ width: `${s.khatmaPct * 100}%` }} />
      </span>
      <small className="muted">بجزء في اليوم، الختمة دي تخلص {formatShortDate(fromKey(s.finish))} إن شاء الله</small>

      <div className="stat-row mini">
        <div className="stat">
          <strong>{num(s.current)}</strong>
          <span>يوم ورا بعض</span>
        </div>
        <div className="stat">
          <strong>{s.todayDone ? '✓' : `${num(s.pagesToday)}/${num(s.pagesTotal)}`}</strong>
          <span>{s.todayDone ? 'ورد النهارده' : 'صفحة النهارده'}</span>
        </div>
        <div className="stat">
          <strong>{num(s.minWeek)}</strong>
          <span>دقيقة الأسبوع ده</span>
        </div>
      </div>

      <div className="q-grid" aria-label="آخر ٤ أسابيع">
        {s.grid.map((g) => (
          <span key={g.k} className={`q-cell ${g.k === today ? 'is-today' : ''}`} style={{ '--q': g.v }} title={g.k} />
        ))}
      </div>
      <small className="muted">
        آخر ٤ أسابيع: المربع المليان = خلّصت الورد، والفاتح = قريت جزء منه. أطول سلسلة: {num(s.best)} يوم.
      </small>
    </section>
  )
}
