import { useState } from 'react'
import Icon from './Icon.jsx'
import { db } from '../db.js'
import { formatShortDate, fromKey, num } from '../lib/dates.js'
import { GOAL_STATUS, daysLeft, goalProgress, sortGoals } from '../lib/goals.js'

const PRIO = [
  [1, 'مهم جدًا'],
  [2, 'مهم'],
  [3, 'عادي'],
]

export default function Goals({ goals }) {
  const [open, setOpen] = useState(null)
  const [newTitle, setNewTitle] = useState('')

  async function addGoal(e) {
    e.preventDefault()
    const clean = newTitle.trim()
    if (!clean) return
    await db.goals.add({
      title: clean,
      targetDate: '',
      note: '',
      done: false,
      status: 'active',
      priority: 2,
      steps: [],
      order: goals.length + 1,
    })
    setNewTitle('')
  }

  const sorted = sortGoals(goals)
  const first = sorted.find((g) => (g.status || 'active') === 'active')
  const paused = sorted.filter((g) => g.status === 'paused')

  return (
    <section className="card">
      <div className="row-between">
        <h2>أهدافي ومشاريعي</h2>
        {paused.length > 0 && <span className="pill st-slipped">{num(paused.length)} متوقفة</span>}
      </div>
      <ul className="goals">
        {sorted.map((g) => (
          <GoalItem
            key={g.id}
            g={g}
            isFirst={g === first}
            open={open === g.id}
            onToggle={() => setOpen(open === g.id ? null : g.id)}
          />
        ))}
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

function GoalItem({ g, open, onToggle, isFirst }) {
  const status = g.status || (g.done ? 'done' : 'active')
  const [step, setStep] = useState('')
  const steps = g.steps || []
  const p = goalProgress(g)
  const left = daysLeft(g)
  const doneSteps = steps.filter((s) => s.done).length

  // بنعدّل على آخر نسخة في قاعدة البيانات عشان لو ضفت كذا خطوة ورا بعض بسرعة ما تضيعش
  const editSteps = (fn) =>
    db.goals
      .where('id')
      .equals(g.id)
      .modify((x) => {
        x.steps = fn(x.steps || [])
      })

  async function addStep(e) {
    e.preventDefault()
    const clean = step.trim()
    if (!clean) return
    await editSteps((cur) => [...cur, { id: Date.now() + Math.random(), title: clean, done: false }])
    setStep('')
  }

  let sub
  if (status === 'done') sub = 'اتحقق ✓'
  else if (status === 'paused') sub = 'بدأته وسبته'
  else if (g.targetDate) sub = `${formatShortDate(fromKey(g.targetDate))}، ${left >= 0 ? `باقي ${num(left)} يوم` : 'المعاد عدّى'}`
  else sub = 'لسه ما حددتش معاد'

  return (
    <li className={`goal ${status === 'done' ? 'is-done' : ''} ${status === 'paused' ? 'is-paused' : ''} ${isFirst ? 'is-first' : ''}`}>
      {isFirst && <span className="first-tag">ابدأ بده الأول</span>}
      <button className="goal-top link-row" onClick={onToggle} aria-expanded={open}>
        <span className="goal-icon">
          <Icon name={status === 'done' ? 'check' : 'star'} size={18} />
        </span>
        <span className="tl-text">
          <strong>{g.title}</strong>
          <small>{sub}</small>
        </span>
        <span className="goal-pct">{num(Math.round(p * 100))}٪</span>
      </button>
      <span className="bar bar-goal">
        <span style={{ width: `${p * 100}%` }} />
      </span>
      {!open && steps.length > 0 && (
        <small className="muted goal-steps-sum">
          {num(doneSteps)} من {num(steps.length)} خطوات
          {status !== 'done' && steps.find((s) => !s.done) && `، الجاية: ${steps.find((s) => !s.done).title}`}
        </small>
      )}
      {open && (
        <div className="goal-edit">
          <div className="seg" role="radiogroup" aria-label="الحالة">
            {Object.entries(GOAL_STATUS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={status === id ? 'is-on' : ''}
                onClick={() => db.goals.update(g.id, { status: id, done: id === 'done' })}
              >
                {label}
              </button>
            ))}
          </div>
          {status !== 'done' && (
            <div className="seg" role="radiogroup" aria-label="الأولوية">
              {PRIO.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={(g.priority || 2) === v ? 'is-on' : ''}
                  onClick={() => db.goals.update(g.id, { priority: v })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <ul className="tasks">
            {steps.map((s) => (
              <li key={s.id} className={`task ${s.done ? 'is-done' : ''}`}>
                <span className="task-title">{s.title}</span>
                <button
                  className="icon-btn"
                  onClick={() => editSteps((cur) => cur.filter((x) => x.id !== s.id))}
                  aria-label="امسح الخطوة"
                >
                  <Icon name="trash" size={17} />
                </button>
                <button
                  className={`check ${s.done ? 'is-done' : ''}`}
                  onClick={() => editSteps((cur) => cur.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                  aria-pressed={s.done}
                  aria-label={s.title}
                >
                  <Icon name="check" size={18} stroke={2.6} />
                </button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={addStep}>
            <input
              className="input"
              placeholder="خطوة جديدة… (مثلًا: أخلص كورس B1)"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              maxLength={80}
            />
            <button className="btn btn-ghost" type="submit" aria-label="ضيف الخطوة">
              <Icon name="plus" size={18} />
            </button>
          </form>
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
            <span>ملاحظة (مستواك دلوقتي، الخطوة الجاية…)</span>
            <input
              className="input"
              defaultValue={g.note}
              onBlur={(e) => db.goals.update(g.id, { note: e.target.value.trim() })}
              maxLength={120}
            />
          </label>
          <div className="row">
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
}
