import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { AddTaskForm, TaskItem } from '../components/TaskParts.jsx'
import { db } from '../db.js'
import { useNow } from '../hooks.js'
import { formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { TASK_CATS, catOf, groupTasks } from '../lib/tasks.js'

const FILTERS = [['all', 'الكل'], ...Object.entries(TASK_CATS).map(([id, c]) => [id, c.label])]

export default function Tasks() {
  const now = useNow()
  const today = todayKey(now)
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const all = useLiveQuery(() => db.tasks.toArray(), [])
  const checks = useLiveQuery(() => db.checks.where('date').equals(today).toArray(), [today])
  if (!all || !checks) return null

  const checked = new Set(checks.map((c) => c.item))
  const pass = (t) => filter === 'all' || catOf(t) === filter
  const g = groupTasks(all.filter(pass), today)
  const pending = g.today.filter((t) => !t.done)
  const doneToday = g.today.filter((t) => t.done)
  const dailyDone = g.daily.filter((t) => checked.has(`task:${t.id}`)).length
  const total = g.today.length + g.daily.length
  const doneCount = doneToday.length + dailyDone

  // اللي خلص في آخر ٧ أيام (غير النهارده)
  const recentDone = all
    .filter(pass)
    .filter((t) => t.kind === 'once' && t.done && t.doneDate && t.doneDate < today)
    .sort((a, b) => b.doneDate.localeCompare(a.doneDate))
    .slice(0, 20)

  const upcomingByDate = {}
  for (const t of g.upcoming) (upcomingByDate[t.date] ||= []).push(t)

  return (
    <>
      <header className="page-head">
        <div className="row-between">
          <h1>المهام</h1>
          <button className="link-btn" onClick={() => setEditing(!editing)}>
            {editing ? 'تم' : 'تعديل'}
          </button>
        </div>
        <p className="muted">
          النهارده: {num(doneCount)} من {num(total)}
          {pending.some((t) => t.date < today) && `، فيه ${num(pending.filter((t) => t.date < today).length)} متأخرة`}
        </p>
        {total > 0 && (
          <span className="bar bar-work">
            <span style={{ width: `${(doneCount / total) * 100}%` }} />
          </span>
        )}
      </header>

      <div className="phrase-scroll" role="radiogroup" aria-label="فلتر">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'chip-on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {adding ? (
        <AddTaskForm today={today} onClose={() => setAdding(false)} defaultCategory={filter === 'all' ? 'work' : filter} />
      ) : (
        <button className="btn btn-wide" onClick={() => setAdding(true)}>
          <Icon name="plus" size={20} />
          مهمة جديدة
        </button>
      )}

      <TaskSection title="النهارده" empty="مفيش مهام النهارده. استمتع 🌿" count={pending.length}>
        {pending.map((t) => (
          <TaskItem key={t.id} t={t} done={false} today={today} editing={editing} />
        ))}
      </TaskSection>

      {g.daily.length > 0 && (
        <TaskSection title="كل يوم" count={`${num(dailyDone)}/${num(g.daily.length)}`}>
          {g.daily.map((t) => (
            <TaskItem key={t.id} t={t} done={checked.has(`task:${t.id}`)} today={today} editing={editing} />
          ))}
        </TaskSection>
      )}

      {g.upcoming.length > 0 && (
        <TaskSection title="جاية" count={g.upcoming.length}>
          {Object.entries(upcomingByDate).map(([date, list]) => (
            <li key={date} className="task-group">
              <span className="tasks-label">{formatShortDate(fromKey(date))}</span>
              <ul className="tasks">
                {list.map((t) => (
                  <TaskItem key={t.id} t={t} done={false} today={today} editing={editing} />
                ))}
              </ul>
            </li>
          ))}
        </TaskSection>
      )}

      {doneToday.length > 0 && (
        <TaskSection title="خلصت النهارده" count={doneToday.length}>
          {doneToday.map((t) => (
            <TaskItem key={t.id} t={t} done today={today} editing={editing} />
          ))}
        </TaskSection>
      )}

      {recentDone.length > 0 && (
        <section className="card">
          <button className="row-between link-row" onClick={() => setShowDone(!showDone)}>
            <h2>خلصت قبل كده</h2>
            <span className="muted">{showDone ? 'خبّي' : `${num(recentDone.length)} — اعرض`}</span>
          </button>
          {showDone && (
            <ul className="tasks">
              {recentDone.map((t) => (
                <TaskItem key={t.id} t={t} done today={today} editing={editing} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function TaskSection({ title, count, empty, children }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <section className="card">
      <div className="row-between">
        <h2>{title}</h2>
        {count !== undefined && count !== 0 && <span className="pill">{typeof count === 'number' ? num(count) : count}</span>}
      </div>
      {has ? <ul className="tasks">{children}</ul> : empty && <p className="muted">{empty}</p>}
    </section>
  )
}
