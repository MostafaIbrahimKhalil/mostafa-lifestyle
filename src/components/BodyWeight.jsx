import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from './Icon.jsx'
import { db, setSetting } from '../db.js'
import { addDays, dateKey, formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { bodyTrend } from '../lib/body.js'

const r1 = (v) => Math.round(v * 10) / 10
const sign = (v) => (v > 0 ? `+${num(r1(v))}` : v < 0 ? `−${num(r1(-v))}` : num(0))

// جسمي: الوزن كل يوم (والمهم متوسط الأسبوع)، والوسط كل جمعة، والـ InBody كل شهر
export default function BodyWeight({ settings }) {
  const rows = useLiveQuery(() => db.body.orderBy('date').toArray(), [])
  const [kg, setKg] = useState('')
  const [waist, setWaist] = useState('')
  const [inbody, setInbody] = useState(null)
  const goal = settings.weightGoal ?? 85
  if (!rows) return null

  const today = todayKey()
  const t = bodyTrend(rows, today)
  const todayRow = rows.find((r) => r.date === today)
  const isFriday = fromKey(today).getDay() === 5
  const waistDue = !t.lastWaist || t.lastWaist.date <= dateKey(addDays(fromKey(today), -6))
  const inbodyDue = !t.lastInbody || t.lastInbody.date <= dateKey(addDays(fromKey(today), -28))

  async function saveField(fields) {
    await db.transaction('rw', db.body, async () => {
      const cur = (await db.body.get(today)) || { date: today }
      await db.body.put({ ...cur, ...fields })
    })
  }

  async function saveKg(e) {
    e.preventDefault()
    const v = Number(String(kg).replace(',', '.'))
    if (!v || v < 30 || v > 300) return
    await saveField({ kg: r1(v) })
    setKg('')
  }

  async function saveWaist(e) {
    e.preventDefault()
    const v = Number(String(waist).replace(',', '.'))
    if (!v || v < 40 || v > 200) return
    await saveField({ waist: r1(v) })
    setWaist('')
  }

  return (
    <section className="card body-card">
      <div className="row-between">
        <h2>جسمي</h2>
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

      {t.weekAvg ? (
        <div className="weight-stats">
          <div>
            <strong>{num(r1(t.weekAvg))}</strong>
            <small>متوسط الأسبوع</small>
          </div>
          <div>
            <strong>{t.prevWeekAvg ? sign(t.weekAvg - t.prevWeekAvg) : '—'}</strong>
            <small>عن الأسبوع اللي فات</small>
          </div>
          <div>
            <strong>{t.weekAvg - goal > 0 ? num(r1(t.weekAvg - goal)) : '✓'}</strong>
            <small>{t.weekAvg - goal > 0 ? 'فاضل للهدف' : 'وصلت للهدف'}</small>
          </div>
        </div>
      ) : (
        <p className="muted">اوزن نفسك كل يوم الصبح بعد الحمام وقبل الأكل. الرقم اليومي بيتهز بالمية والملح، فالتطبيق بيبصلك على متوسط الأسبوع.</p>
      )}
      {t.weeks.length >= 2 && <Sparkline points={t.weeks} goal={goal} />}
      {t.first && t.weekAvg && <p className="muted small">من أول ما بدأت ({formatShortDate(fromKey(t.first.date))}): {sign(t.weekAvg - t.first.kg)} كيلو</p>}

      {!todayRow?.kg ? (
        <form className="row" onSubmit={saveKg}>
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="وزن النهارده (كيلو)" value={kg} onChange={(e) => setKg(e.target.value)} />
          <button className="btn" type="submit" aria-label="سجّل الوزن">
            <Icon name="check" size={18} />
          </button>
        </form>
      ) : (
        <p className="muted small">وزن النهارده: {num(todayRow.kg)} ✓</p>
      )}

      <div className="body-row">
        <span>
          <strong>الوسط</strong>
          <small className="muted">
            {t.lastWaist ? `${num(t.lastWaist.waist)} سم${t.waistChange ? `، ${sign(t.waistChange)} من أول قياس` : ''}` : 'متر قماش حوالين السرة، كل جمعة الصبح'}
          </small>
        </span>
      </div>
      {(waistDue || isFriday) && !todayRow?.waist && (
        <form className="row" onSubmit={saveWaist}>
          <input className="input" type="number" inputMode="decimal" step="0.5" placeholder="مقاس الوسط (سم)" value={waist} onChange={(e) => setWaist(e.target.value)} />
          <button className="btn" type="submit" aria-label="سجّل الوسط">
            <Icon name="check" size={18} />
          </button>
        </form>
      )}

      <div className="body-row">
        <span>
          <strong>InBody</strong>
          <small className="muted">
            {t.lastInbody
              ? `${formatShortDate(fromKey(t.lastInbody.date))}: دهون ${num(t.lastInbody.fat)}٪، عضل ${num(t.lastInbody.muscle)} كيلو، مية ${num(t.lastInbody.water)}٪`
              : 'مرة في الشهر في الجيم: نسبة الدهون والعضل والمية'}
          </small>
          {t.inbodyChange && (
            <small className={t.inbodyChange.fat <= 0 ? 'pos' : 'neg'}>
              عن المرة اللي قبلها: دهون {sign(t.inbodyChange.fat)}٪، عضل {sign(t.inbodyChange.muscle)} كيلو
            </small>
          )}
        </span>
        {!inbody && (
          <button className={`btn ${inbodyDue ? '' : 'btn-ghost'} btn-small`} onClick={() => setInbody({ fat: '', muscle: '', water: '' })}>
            سجّل
          </button>
        )}
      </div>
      {inbody && (
        <form
          className="add-task"
          onSubmit={async (e) => {
            e.preventDefault()
            const n = (v) => Number(String(v).replace(',', '.')) || null
            if (!n(inbody.fat)) return
            await saveField({ fat: n(inbody.fat), muscle: n(inbody.muscle), water: n(inbody.water), ...(n(inbody.kg) ? { kg: n(inbody.kg) } : {}) })
            setInbody(null)
          }}
        >
          <div className="inbody-grid">
            {[
              ['fat', 'نسبة الدهون ٪'],
              ['muscle', 'كتلة العضل (كيلو)'],
              ['water', 'نسبة المية ٪'],
              ['kg', 'الوزن (اختياري)'],
            ].map(([k, label]) => (
              <label key={k} className="field">
                <span>{label}</span>
                <input className="input" type="number" inputMode="decimal" step="0.1" value={inbody[k] ?? ''} onChange={(e) => setInbody({ ...inbody, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="row">
            <button className="btn" type="submit">
              حفظ
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setInbody(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Sparkline({ points, goal }) {
  const W = 300
  const H = 80
  const vals = points.map((p) => p.avg)
  const min = Math.min(goal, ...vals) - 1
  const max = Math.max(...vals) + 1
  const x = (i) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * (W - 16) + 8)
  const y = (v) => H - 8 - ((v - min) / (max - min)) * (H - 16)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" role="img" aria-label="متوسط الوزن كل أسبوع">
      <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} className="spark-goal" />
      <path d={d} className="spark-line" />
      {points.map((p, i) => (
        <circle key={p.from} cx={x(i)} cy={y(p.avg)} r={i === points.length - 1 ? 4 : 2.5} className="spark-dot" />
      ))}
    </svg>
  )
}
