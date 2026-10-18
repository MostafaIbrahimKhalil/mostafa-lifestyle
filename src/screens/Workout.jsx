import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setCheck } from '../db.js'
import { num } from '../lib/dates.js'
import { CARDIO_KINDS, EXERCISES, suggestion } from '../lib/workout.js'

// شاشة تمرين النهارده: التمارين بالمجموعات والأوزان المقترحة، والكارديو
export default function Workout({ routine, today, onClose }) {
  // null = لسه مفيش جلسة النهارده، undefined = لسه بيحمّل
  const session = useLiveQuery(async () => (await db.workouts.where('date').equals(today).first()) || null, [today])
  const history = useLiveQuery(
    () => db.workouts.where('date').below(today).reverse().sortBy('date'),
    [today],
  )
  const [openTip, setOpenTip] = useState(null)

  // أول مرة نفتح النهارده: نعمل جلسة جديدة
  useEffect(() => {
    if (session !== null) return
    db.transaction('rw', db.workouts, async () => {
      const exists = await db.workouts.where('date').equals(today).count()
      if (!exists) await db.workouts.add({ date: today, routine: routine.id, sets: {}, cardio: null, done: false })
    })
  }, [session, today, routine.id])

  if (!session || !history) return null

  const lastSetsFor = (exId) => {
    const prev = history.find((w) => w.sets?.[exId]?.some((s) => s.done))
    return prev ? prev.sets[exId].filter((s) => s.done) : null
  }

  const cardioTarget = routine.exercises.length ? routine.cardio : routine.walk
  const cardio = session.cardio || {
    kind: routine.exercises.length ? 'treadmill' : 'walk',
    minutes: cardioTarget,
    done: false,
  }
  const exDone = routine.exercises.filter((id) => (session.sets?.[id] || []).filter((s) => s.done).length >= EXERCISES[id].sets)
  const totalParts = routine.exercises.length + 1
  const doneParts = exDone.length + (cardio.done ? 1 : 0)

  async function saveSession(patch) {
    await db.workouts.update(session.id, patch)
  }

  async function updateSet(exId, i, patch) {
    await db.transaction('rw', db.workouts, async () => {
      const w = await db.workouts.get(session.id)
      const ex = EXERCISES[exId]
      const sug = suggestion(exId, lastSetsFor(exId))
      const sets = [...(w.sets?.[exId] || [])]
      while (sets.length < ex.sets) sets.push({ w: sug.weight ?? '', r: sug.reps, done: false })
      sets[i] = { ...sets[i], ...patch }
      await db.workouts.update(session.id, { sets: { ...w.sets, [exId]: sets } })
    })
  }

  async function finish() {
    await saveSession({ done: true, finishedAt: new Date().toISOString() })
    await setCheck(today, 'gym', true, routine.id)
    onClose(true)
  }

  return (
    <div className="reader" role="dialog" aria-label={routine.name}>
      <header className="reader-bar">
        <button className="icon-btn" onClick={() => onClose(false)} aria-label="رجوع">
          <Icon name="chevronRight" />
        </button>
        <div className="reader-title">
          <strong>{routine.name}</strong>
          <small>
            {num(doneParts)} من {num(totalParts)}
          </small>
        </div>
        <span style={{ width: 40 }} />
      </header>
      <span className="reader-progress">
        <span style={{ width: `${(doneParts / totalParts) * 100}%` }} />
      </span>

      <div className="reader-body workout-body">
        {routine.exercises.length > 0 && (
          <p className="muted">
            سخّن ٥ دقايق مشي الأول. وبين كل مجموعة والتانية استريح دقيقة لدقيقة ونص.
          </p>
        )}

        {routine.exercises.map((exId) => {
          const ex = EXERCISES[exId]
          const last = lastSetsFor(exId)
          const sug = suggestion(exId, last)
          const sets = session.sets?.[exId] || []
          const rowsArr = Array.from({ length: ex.sets }, (_, i) => sets[i] || { w: sug.weight ?? '', r: sug.reps, done: false })
          const isDone = exDone.includes(exId)
          return (
            <section key={exId} className={`card ex ${isDone ? 'is-done' : ''}`}>
              <div className="row-between">
                <div className="tl-text">
                  <strong>{ex.name}</strong>
                  <small>
                    {num(ex.sets)} مجموعات × {num(ex.reps[0])}–{num(ex.reps[1])} {ex.unit || 'عدّة'}
                  </small>
                </div>
                <button className="link-btn" onClick={() => setOpenTip(openTip === exId ? null : exId)}>
                  {openTip === exId ? 'خبّي' : 'إزاي؟'}
                </button>
              </div>
              {openTip === exId && (
                <div className="ex-tip">
                  <p>{ex.tip}</p>
                  <p className="ex-mistake">⚠︎ {ex.mistake}</p>
                </div>
              )}
              <p className="ex-sug">
                {last
                  ? `آخر مرة: ${last.map((s) => (ex.noWeight ? num(s.r) : `${num(s.w)}×${num(s.r)}`)).join(' · ')} — ${sug.note}`
                  : sug.note}
              </p>
              <div className="sets">
                {rowsArr.map((s, i) => (
                  <div key={i} className={`set ${s.done ? 'is-done' : ''}`}>
                    <span className="set-no">{num(i + 1)}</span>
                    {!ex.noWeight && (
                      <label className="set-field">
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          placeholder="كيلو"
                          value={s.w}
                          onChange={(e) => updateSet(exId, i, { w: e.target.value })}
                          aria-label={`وزن المجموعة ${i + 1}`}
                        />
                        <small>كيلو</small>
                      </label>
                    )}
                    <label className="set-field">
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={s.r}
                        onChange={(e) => updateSet(exId, i, { r: e.target.value })}
                        aria-label={`عدّات المجموعة ${i + 1}`}
                      />
                      <small>{ex.unit || 'عدّة'}</small>
                    </label>
                    <button
                      className={`check ${s.done ? 'is-done' : ''}`}
                      onClick={() => updateSet(exId, i, { done: !s.done })}
                      aria-pressed={s.done}
                      aria-label={`خلّصت المجموعة ${i + 1}`}
                    >
                      <Icon name="check" size={18} stroke={2.6} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        <section className={`card ex ${cardio.done ? 'is-done' : ''}`}>
          <div className="tl-text">
            <strong>{routine.exercises.length ? `كارديو ${num(routine.cardio)} دقيقة` : routine.name}</strong>
            <small>
              {routine.exercises.length
                ? 'بعد الحديد. بسرعة تقدر تتكلم فيها بس بصعوبة'
                : `مشي ${num(routine.walk)} دقيقة، أو إيروبك ${num(routine.cardio || 40)} دقيقة`}
            </small>
          </div>
          <div className="seg seg-small" role="radiogroup" aria-label="نوع الكارديو">
            {CARDIO_KINDS.map(([id, label]) => (
              <button
                key={id}
                className={cardio.kind === id ? 'is-on' : ''}
                onClick={() =>
                  saveSession({
                    cardio: {
                      ...cardio,
                      kind: id,
                      minutes: !routine.exercises.length && id !== 'walk' ? routine.cardio || 40 : cardio.minutes,
                    },
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="set">
            <label className="set-field set-field-wide">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                value={cardio.minutes}
                onChange={(e) => saveSession({ cardio: { ...cardio, minutes: e.target.value } })}
                aria-label="الدقايق"
              />
              <small>دقيقة</small>
            </label>
            <button
              className={`check ${cardio.done ? 'is-done' : ''}`}
              onClick={() => saveSession({ cardio: { ...cardio, done: !cardio.done } })}
              aria-pressed={cardio.done}
              aria-label="خلّصت الكارديو"
            >
              <Icon name="check" size={18} stroke={2.6} />
            </button>
          </div>
        </section>

        <button className="btn btn-wide" onClick={finish}>
          <Icon name="check" size={20} />
          {doneParts >= totalParts ? 'خلّصت التمرين 💪' : 'خلّصت التمرين (حتى لو مش كله)'}
        </button>
        <p className="muted center">أنا مش مدرب — لو حسيت بألم (مش تعب) وقّف التمرين ده.</p>
      </div>
    </div>
  )
}
