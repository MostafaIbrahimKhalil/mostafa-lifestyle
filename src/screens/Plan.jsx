import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { TaskItem } from '../components/TaskParts.jsx'
import { db } from '../db.js'
import { formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { postStage } from '../lib/plan.js'
import { PLAN_LATER, PLAN_RULES, PLAN_TITLE, PLAN_WEEKS } from '../data/plan2026.js'

// صفحة "خطتي": الضروري، والأسبوع ده، والأسابيع لحد ديسمبر، والقواعد
export default function Plan({ onOpen }) {
  const today = todayKey()
  const data = useLiveQuery(async () => {
    const [tasks, posts, appts] = await Promise.all([db.tasks.toArray(), db.posts.orderBy('date').toArray(), db.appts.orderBy('date').toArray()])
    return { tasks, posts, appts }
  }, [])
  if (!data) return null

  const planTasks = data.tasks.filter((t) => t.plan === '2026-q4' && t.kind === 'once')
  const essentials = planTasks.filter((t) => t.essential)
  const week = PLAN_WEEKS.find((w) => w.from <= today && today <= w.to)
  const weekTasks = week ? planTasks.filter((t) => t.date >= week.from && t.date <= week.to).sort((a, b) => a.date.localeCompare(b.date)) : []
  const overdue = planTasks.filter((t) => !t.done && week && t.date < week.from)
  const doneCount = planTasks.filter((t) => t.done).length
  const nextPost = data.posts.find((p) => p.date >= today)
  const nextAppt = data.appts.find((a) => !a.done && a.date >= today)
  const posted = data.posts.filter((p) => postStage(p, today).cls === 'pill-ok').length

  return (
    <>
      <header className="page-head">
        <h1>{PLAN_TITLE}</h1>
        <p className="muted">
          خلصت {num(doneCount)} من {num(planTasks.length)} مهمة في الخطة
        </p>
      </header>

      <section className="card">
        <h2>الضروري فعلًا</h2>
        <p className="muted">لو عملت الأربعة دول بس، الشهرين هيمشوا كويس، حتى لو الولادة جت في أي يوم.</p>
        <ul className="tasks">
          {essentials.map((t) => (
            <TaskItem key={t.id} t={t} done={t.done} today={today} showDate />
          ))}
        </ul>
      </section>

      {week && (
        <section className="card week-now">
          <div className="row-between">
            <h2>الأسبوع ده</h2>
            <span className="pill">{week.label}</span>
          </div>
          <dl className="week-grid">
            {week.home && (
              <>
                <dt>البيت</dt>
                <dd>{week.home}</dd>
              </>
            )}
            <dt>الشغل</dt>
            <dd>{week.work}</dd>
            <dt>المحتوى</dt>
            <dd>{week.content}</dd>
          </dl>
          {(overdue.length > 0 || weekTasks.length > 0) && (
            <ul className="tasks">
              {[...overdue, ...weekTasks].map((t) => (
                <TaskItem key={t.id} t={t} done={t.done} today={today} showDate />
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="plan-links">
        <button className="card card-action" onClick={() => onOpen('posts')}>
          <span className="card-icon">
            <Icon name="calendar" />
          </span>
          <span>
            <strong>جدول النشر</strong>
            <small>
              نزل {num(posted)} من {num(data.posts.length)}
              {nextPost ? `، الجاي: ${nextPost.title} ${formatShortDate(fromKey(nextPost.date))}` : ''}
            </small>
          </span>
          <Icon name="chevronLeft" size={18} />
        </button>
        <button className="card card-action" onClick={() => onOpen('baby')}>
          <span className="card-icon">
            <Icon name="heart" />
          </span>
          <span>
            <strong>البيت والمولود</strong>
            <small>{nextAppt ? `${nextAppt.title} ${formatShortDate(fromKey(nextAppt.date))}` : 'التطعيمات والدكاترة والمشتريات'}</small>
          </span>
          <Icon name="chevronLeft" size={18} />
        </button>
      </div>

      <section className="card">
        <h2>الأسابيع لحد ديسمبر</h2>
        <ul className="weeks">
          {PLAN_WEEKS.map((w) => {
            const ts = planTasks.filter((t) => t.date >= w.from && t.date <= w.to)
            const past = w.to < today
            return (
              <li key={w.from} className={`wk ${w === week ? 'is-now' : ''} ${past ? 'is-past' : ''}`}>
                <div className="row-between">
                  <strong>{w.label}</strong>
                  {ts.length > 0 && (
                    <small className="muted">
                      {num(ts.filter((t) => t.done).length)}/{num(ts.length)} ✓
                    </small>
                  )}
                </div>
                {w.home && <p><span className="wk-tag home">البيت</span>{w.home}</p>}
                <p><span className="wk-tag work">الشغل</span>{w.work}</p>
                <p><span className="wk-tag content">المحتوى</span>{w.content}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2>قواعد الشهرين</h2>
        <ul className="section-items">
          {PLAN_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="muted">{PLAN_LATER}</p>
        <p className="muted">المشاريع (تفضية اللاب، وكالات الأخبار، قناة الألماني، موقع الألماني، DW) بخطواتها في تقدّمي ← أهدافي ومشاريعي.</p>
      </section>
    </>
  )
}
