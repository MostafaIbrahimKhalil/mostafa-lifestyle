import { useState } from 'react'
import Icon from './Icon.jsx'
import { addDays, dateKey, formatShortDate, fromKey, num } from '../lib/dates.js'
import { PRIORITY, TASK_CATS, addTask, catOf, removeTask, toggleTask } from '../lib/tasks.js'

export function CheckButton({ done, onToggle, label }) {
  return (
    <button
      className={`check ${done ? 'is-done' : ''}`}
      onClick={() => onToggle(!done)}
      aria-pressed={done}
      aria-label={label}
    >
      <Icon name="check" size={18} stroke={2.6} />
    </button>
  )
}

export function TaskItem({ t, done, today, editing, showDate }) {
  const cat = TASK_CATS[catOf(t)]
  const overdue = t.kind === 'once' && !t.done && t.date < today
  return (
    <li className={`task ${done ? 'is-done' : ''}`}>
      {t.kind === 'once' ? (
        <span className={`prio ${PRIORITY[t.priority]?.cls}`} title={PRIORITY[t.priority]?.label} />
      ) : (
        <span className="prio p-repeat" title="كل يوم" />
      )}
      <span className="task-title">
        {t.title}
        <span className="task-meta">
          <span className="cat-tag" style={{ '--cat': cat.color }}>
            {cat.label}
          </span>
          {overdue && <small className="carried">متأخرة من {formatShortDate(fromKey(t.date))}</small>}
          {showDate && !overdue && t.kind === 'once' && <small>{formatShortDate(fromKey(t.date))}</small>}
        </span>
      </span>
      {editing ? (
        <button
          className="icon-btn"
          onClick={() =>
            (t.kind !== 'daily' || window.confirm(`تشيل "${t.title}" من مهام كل يوم؟`)) && removeTask(t)
          }
          aria-label="امسح المهمة"
        >
          <Icon name="trash" size={18} />
        </button>
      ) : (
        <CheckButton done={done} onToggle={(d) => toggleTask(t, d, today)} label={t.title} />
      )}
    </li>
  )
}

export function AddTaskForm({ today, onClose, defaultCategory = 'work' }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [when, setWhen] = useState('today') // today | tomorrow | date | daily
  const [date, setDate] = useState(dateKey(addDays(fromKey(today), 2)))
  const [priority, setPriority] = useState(2)
  const [added, setAdded] = useState(0)

  async function submit(e) {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    const target = when === 'tomorrow' ? dateKey(addDays(fromKey(today), 1)) : when === 'date' ? date : today
    await addTask({
      title: clean,
      kind: when === 'daily' ? 'daily' : 'once',
      category,
      priority: when === 'daily' ? 2 : priority,
      date: target,
    })
    setTitle('')
    setAdded((n) => n + 1)
  }

  return (
    <form className="add-task card" onSubmit={submit}>
      <input
        className="input"
        placeholder="المهمة…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        maxLength={80}
        enterKeyHint="done"
      />
      <div className="seg" role="radiogroup" aria-label="التصنيف">
        {Object.entries(TASK_CATS).map(([id, c]) => (
          <button key={id} type="button" className={category === id ? 'is-on' : ''} onClick={() => setCategory(id)}>
            <span className="swatch" style={{ background: c.color }} /> {c.label}
          </button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="إمتى">
        {[
          ['today', 'النهارده'],
          ['tomorrow', 'بكرة'],
          ['date', 'يوم تاني'],
          ['daily', 'كل يوم'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={when === id ? 'is-on' : ''} onClick={() => setWhen(id)}>
            {label}
          </button>
        ))}
      </div>
      {when === 'date' && (
        <input
          className="input"
          type="date"
          value={date}
          min={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="التاريخ"
        />
      )}
      {when !== 'daily' && (
        <div className="seg" role="radiogroup" aria-label="الأولوية">
          {[1, 2, 3].map((p) => (
            <button key={p} type="button" className={priority === p ? 'is-on' : ''} onClick={() => setPriority(p)}>
              <span className={`prio ${PRIORITY[p].cls}`} /> {PRIORITY[p].label}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <button className="btn" type="submit">
          ضيف
        </button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          خلاص
        </button>
        {added > 0 && <span className="muted added-note">اتضاف {num(added)} ✓</span>}
      </div>
    </form>
  )
}
