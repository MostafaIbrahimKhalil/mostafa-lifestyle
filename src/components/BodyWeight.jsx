import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from './Icon.jsx'
import { db, setSetting } from '../db.js'
import { addDays, dateKey, formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'

// وزن الجسم: تسجيل مرة في الأسبوع، وخط بيوضح الاتجاه
export default function BodyWeight({ settings }) {
  const rows = useLiveQuery(() => db.body.orderBy('date').toArray(), [])
  const [kg, setKg] = useState('')
  const goal = settings.weightGoal ?? 85
  if (!rows) return null

  const today = todayKey()
  const last = rows.at(-1)
  const first = rows[0]
  const dueNow = !last || last.date <= dateKey(addDays(fromKey(today), -6))
  const lost = first && last ? Math.round((first.kg - last.kg) * 10) / 10 : 0
  const left = last ? Math.round((last.kg - goal) * 10) / 10 : null

  async function save(e) {
    e.preventDefault()
    const v = Number(String(kg).replace(',', '.'))
    if (!v || v < 30 || v > 300) return
    await db.body.put({ date: today, kg: Math.round(v * 10) / 10 })
    setKg('')
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>وزني</h2>
        <button
          className="link-btn"
          onClick={() => {
            const v = window.prompt('هدفك كام كيلو؟', String(goal))
            if (v && Number(v) > 30) setSetting('weightGoal', Number(v))
          }}
        >
          الهدف {num(goal)} كيلو
        </button>
      </div>
      {last ? (
        <div className="weight-stats">
          <div>
            <strong>{num(last.kg)}</strong>
            <small>دلوقتي</small>
          </div>
          <div>
            <strong>{lost > 0 ? `−${num(lost)}` : num(Math.abs(lost))}</strong>
            <small>{lost >= 0 ? 'نزلت' : 'زدت'} من {formatShortDate(fromKey(first.date))}</small>
          </div>
          <div>
            <strong>{left > 0 ? num(left) : '✓'}</strong>
            <small>{left > 0 ? 'فاضل للهدف' : 'وصلت للهدف'}</small>
          </div>
        </div>
      ) : (
        <p className="muted">سجّل وزنك مرة في الأسبوع، نفس اليوم ونفس الوقت (الصبح قبل الفطار أحسن).</p>
      )}
      {rows.length >= 2 && <Sparkline rows={rows} goal={goal} />}
      {dueNow ? (
        <form className="row" onSubmit={save}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="وزنك النهارده (كيلو)"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
          <button className="btn" type="submit" aria-label="سجّل الوزن">
            <Icon name="check" size={18} />
          </button>
        </form>
      ) : (
        <p className="muted">الوزن الجاي يوم {formatShortDate(addDays(fromKey(last.date), 7))}</p>
      )}
    </section>
  )
}

function Sparkline({ rows, goal }) {
  const W = 300
  const H = 80
  const vals = rows.map((r) => r.kg)
  const min = Math.min(goal, ...vals) - 1
  const max = Math.max(...vals) + 1
  const x = (i) => (rows.length === 1 ? W / 2 : (i / (rows.length - 1)) * (W - 16) + 8)
  const y = (v) => H - 8 - ((v - min) / (max - min)) * (H - 16)
  const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.kg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" role="img" aria-label="منحنى الوزن">
      <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} className="spark-goal" />
      <path d={d} className="spark-line" />
      {rows.map((r, i) => (
        <circle key={r.date} cx={x(i)} cy={y(r.kg)} r={i === rows.length - 1 ? 4 : 2.5} className="spark-dot" />
      ))}
    </svg>
  )
}
