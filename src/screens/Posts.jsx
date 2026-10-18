import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { postStage } from '../lib/plan.js'

const STEPS = [
  ['edited', 'اتعدّل'],
  ['scheduled', 'اتجدول'],
  ['published', 'نزل'],
]

// جدول النشر: كل فيديو بميعاده والهوك والدعوة، وتعلّم: اتعدّل ← اتجدول ← نزل
export default function Posts() {
  const today = todayKey()
  const posts = useLiveQuery(() => db.posts.orderBy('date').toArray(), [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  if (!posts) return null

  const upcoming = posts.filter((p) => p.date >= today)
  const past = posts.filter((p) => p.date < today)
  const notReady = upcoming.filter((p) => !p.scheduled)

  return (
    <>
      <header className="page-head">
        <h1>جدول النشر</h1>
        <p className="muted">قبل أي فيديو: أقوى جملة في أول تانيتين، والهوك على الشاشة والغلاف، والدعوة في الآخر وفي الكابشن.</p>
      </header>

      {notReady.length > 0 && (
        <div className="card warn-card">
          <span>
            {num(notReady.length)} فيديو جاي لسه ما اتجدولش. أقربهم: <strong>{notReady[0].title}</strong>{' '}
            {formatShortDate(fromKey(notReady[0].date))}
          </span>
        </div>
      )}

      <ul className="posts">
        {[...upcoming, ...past.reverse()].map((p, i) => (
          <PostCard key={p.id} p={p} n={posts.indexOf(p) + 1} today={today} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} first={i === 0} />
        ))}
      </ul>

      {adding ? (
        <AddPost onDone={() => setAdding(false)} />
      ) : (
        <button className="btn btn-ghost btn-wide" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> فيديو جديد
        </button>
      )}
    </>
  )
}

function PostCard({ p, n, today, open, onToggle, first }) {
  const st = postStage(p, today)
  const isToday = p.date === today
  return (
    <li className={`card post ${isToday ? 'is-today' : ''} ${p.date < today ? 'is-past' : ''}`}>
      <button className="link-row post-head" onClick={onToggle}>
        <span className="post-no">{num(n)}</span>
        <span className="tl-text">
          <strong>{p.title}</strong>
          <small>
            {isToday ? 'النهارده' : formatShortDate(fromKey(p.date))}
            {first && !isToday && p.date >= today ? '، الجاي' : ''}
          </small>
        </span>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </button>
      {(open || isToday || first) && (
        <div className="post-body">
          {p.hook && (
            <p>
              <span className="wk-tag">الهوك</span>
              {p.hook}
            </p>
          )}
          {p.cta && (
            <p>
              <span className="wk-tag">الدعوة</span>
              {p.cta}
            </p>
          )}
          {p.edit && (
            <p>
              <span className="wk-tag">التعديل</span>
              {p.edit}
            </p>
          )}
          {p.caption && (
            <p className="post-caption">
              <span className="wk-tag">سطر الكابشن</span>
              {p.caption}
              <button className="mini" onClick={() => navigator.clipboard?.writeText(p.caption)}>
                انسخ
              </button>
            </p>
          )}
        </div>
      )}
      <div className="seg seg-small post-steps">
        {STEPS.map(([k, label]) => (
          <button key={k} className={p[k] ? 'is-on' : ''} onClick={() => db.posts.update(p.id, { [k]: !p[k] })} aria-pressed={!!p[k]}>
            {p[k] ? '✓ ' : ''}
            {label}
          </button>
        ))}
      </div>
      {open && (
        <div className="row">
          <input
            className="input input-small"
            type="date"
            defaultValue={p.date}
            onChange={(e) => e.target.value && db.posts.update(p.id, { date: e.target.value })}
            aria-label="غيّر الميعاد"
          />
          <button className="icon-btn" onClick={() => window.confirm(`تمسح "${p.title}"؟`) && db.posts.delete(p.id)} aria-label="امسح">
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
    </li>
  )
}

function AddPost({ onDone }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey())
  const [hook, setHook] = useState('')
  const [cta, setCta] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    await db.posts.add({ title: title.trim(), date, hook: hook.trim(), cta: cta.trim(), edit: '', caption: '', edited: false, scheduled: false, published: false })
    onDone()
  }

  return (
    <form className="card add-task" onSubmit={save}>
      <input className="input" placeholder="اسم الفيديو" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={60} />
      <input className="input" placeholder="الهوك على الشاشة" value={hook} onChange={(e) => setHook(e.target.value)} maxLength={90} />
      <input className="input" placeholder="الدعوة (احفظه، ابعته لـ…)" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={60} />
      <label className="field field-row">
        <span>ميعاد النشر</span>
        <input className="input input-small" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" type="submit">
          ضيف
        </button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>
          إلغاء
        </button>
      </div>
    </form>
  )
}
