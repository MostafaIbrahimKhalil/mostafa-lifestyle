import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../db.js'
import { formatShortDate, fromKey, num } from '../lib/dates.js'
import { DAY_NAMES, DEFAULT_GYM_DAYS, DEFAULT_GYM_TIME, EXERCISES, ROUTINES, WEEK_ORDER } from '../lib/workout.js'

const CHOICES = [
  ['', 'راحة'],
  ['A', 'حديد A'],
  ['B', 'حديد B'],
  ['cardio', 'كارديو'],
  ['walk', 'مشي (اختياري)'],
]

// جدول التمرين: الأيام والمعاد، والتمارين، وآخر التمرينات
export default function GymPlan({ settings }) {
  const days = settings.gymDays || DEFAULT_GYM_DAYS
  const recent = useLiveQuery(() => db.workouts.orderBy('date').reverse().limit(8).toArray(), [])

  function setDay(d, id) {
    const next = { ...days }
    if (id) next[d] = id
    else delete next[d]
    setSetting('gymDays', next)
  }

  return (
    <>
      <header className="page-head">
        <h1>جدول التمرين</h1>
        <p className="muted">٣ أيام ثابتة كفاية جدًا للبداية. الأكل هو اللي بيحرّك الميزان، والتمرين بيحافظ على عضلك.</p>
      </header>

      <section className="card">
        <h2>أيامك</h2>
        {WEEK_ORDER.map((d) => (
          <label key={d} className="field field-row">
            <span>{DAY_NAMES[d]}</span>
            <select className="input input-small" value={days[d] || ''} onChange={(e) => setDay(d, e.target.value)}>
              {CHOICES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="field field-row">
          <span>معاد الجيم</span>
          <input
            className="input input-small"
            type="time"
            value={settings.gymTime || DEFAULT_GYM_TIME}
            onChange={(e) => e.target.value && setSetting('gymTime', e.target.value)}
          />
        </label>
      </section>

      {['A', 'B'].map((rid) => (
        <section key={rid} className="card">
          <h2>{ROUTINES[rid].name}</h2>
          <ul className="plan-list">
            {ROUTINES[rid].exercises.map((id) => {
              const ex = EXERCISES[id]
              return (
                <li key={id}>
                  <strong>{ex.name}</strong>
                  <span className="muted">
                    {num(ex.sets)}×{num(ex.reps[0])}–{num(ex.reps[1])} {ex.unit || ''}
                  </span>
                </li>
              )
            })}
            <li>
              <strong>كارديو</strong>
              <span className="muted">{num(ROUTINES[rid].cardio)} دقيقة</span>
            </li>
          </ul>
        </section>
      ))}

      <section className="card">
        <h2>يوم الكارديو</h2>
        <p className="muted">
          مشي {num(ROUTINES.cardio.walk)} دقيقة، أو إيروبك/مشاية بميل {num(ROUTINES.cardio.cardio)} دقيقة. بسرعة تقدر تتكلم فيها
          بس بصعوبة.
        </p>
      </section>

      {recent?.length > 0 && (
        <section className="card">
          <h2>آخر تمرينات</h2>
          <ul className="totals">
            {recent.map((w) => (
              <li key={w.id}>
                <span>
                  {formatShortDate(fromKey(w.date))} · {ROUTINES[w.routine]?.name || w.routine}
                </span>
                <strong>{w.done ? '✓' : '…'}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
