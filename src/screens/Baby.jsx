import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import { egp } from '../lib/wallet.js'

const KINDS = { vaccine: 'تطعيم', doctor: 'دكتور' }

// البيت والمولود: مواعيد التطعيمات والدكاترة، ومشتريات المولود
export default function Baby() {
  const today = todayKey()
  const appts = useLiveQuery(() => db.appts.orderBy('date').toArray(), [])
  const items = useLiveQuery(() => db.babyItems.toArray(), [])
  if (!appts || !items) return null

  const upcoming = appts.filter((a) => !a.done)
  const done = appts.filter((a) => a.done).reverse()
  const left = items.filter((i) => !i.bought)
  const leftCost = left.reduce((s, i) => s + (Number(i.price) || 0), 0)

  return (
    <>
      <header className="page-head">
        <h1>البيت والمولود</h1>
        <p className="muted">المواعيد بتطلعلك في جدول اليوم، وييجيلك تذكير قبلها بيوم.</p>
      </header>

      <section className="card">
        <h2>المواعيد</h2>
        {upcoming.length === 0 && <p className="muted">مفيش مواعيد جاية. ضيف التطعيمات من كارت الدكتور أول ما تاخده.</p>}
        <ul className="tasks">
          {upcoming.map((a) => (
            <ApptRow key={a.id} a={a} today={today} />
          ))}
        </ul>
        <AddAppt />
        {done.length > 0 && (
          <details className="done-list">
            <summary className="muted">اللي اتعمل ({num(done.length)})</summary>
            <ul className="tasks">
              {done.map((a) => (
                <ApptRow key={a.id} a={a} today={today} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>مشتريات المولود</h2>
          {left.length > 0 && <span className="pill">فاضل {num(left.length)}{leftCost ? `، ≈ ${egp(leftCost)}` : ''}</span>}
        </div>
        <ul className="tasks">
          {[...left.sort((a, b) => (b.beforeBirth ? 1 : 0) - (a.beforeBirth ? 1 : 0)), ...items.filter((i) => i.bought)].map((i) => (
            <li key={i.id} className={`task ${i.bought ? 'is-done' : ''}`}>
              <span className="task-title">
                {i.name}
                <span className="task-meta">
                  {i.price ? <small>{egp(i.price)}</small> : null}
                  {i.beforeBirth && !i.bought && <small className="late">قبل الولادة</small>}
                </span>
              </span>
              <button className="icon-btn" onClick={() => db.babyItems.delete(i.id)} aria-label="امسح">
                <Icon name="trash" size={16} />
              </button>
              <button className={`check ${i.bought ? 'is-done' : ''}`} onClick={() => db.babyItems.update(i.id, { bought: !i.bought })} aria-pressed={!!i.bought} aria-label={i.name}>
                <Icon name="check" size={18} stroke={2.6} />
              </button>
            </li>
          ))}
        </ul>
        <AddItem />
        <p className="muted">لما تشتري حاجة، سجّل الفلوس في المحفظة ← صرفت (مدرسة وعيال).</p>
      </section>
    </>
  )
}

function ApptRow({ a, today }) {
  const late = !a.done && a.date < today
  return (
    <li className={`task ${a.done ? 'is-done' : ''}`}>
      <span className="task-title">
        {a.title}
        <span className="task-meta">
          <span className="cat-tag" style={{ '--cat': a.kind === 'vaccine' ? 'var(--c-faith)' : 'var(--c-family)' }}>
            {KINDS[a.kind]}
          </span>
          <small className={late ? 'late' : ''}>
            {a.date === today ? 'النهارده' : formatShortDate(fromKey(a.date))}
            {a.place ? `، ${a.place}` : ''}
          </small>
        </span>
      </span>
      <button className="icon-btn" onClick={() => window.confirm(`تمسح "${a.title}"؟`) && db.appts.delete(a.id)} aria-label="امسح">
        <Icon name="trash" size={16} />
      </button>
      <button className={`check ${a.done ? 'is-done' : ''}`} onClick={() => db.appts.update(a.id, { done: !a.done })} aria-pressed={!!a.done} aria-label={a.title}>
        <Icon name="check" size={18} stroke={2.6} />
      </button>
    </li>
  )
}

function AddAppt() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('vaccine')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey())
  const [place, setPlace] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    await db.appts.add({ kind, title: title.trim(), date, place: place.trim(), note: '', done: false })
    setTitle('')
    setPlace('')
  }

  if (!open)
    return (
      <button className="btn btn-ghost btn-wide" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> ميعاد جديد
      </button>
    )
  return (
    <form className="add-task" onSubmit={save}>
      <div className="seg seg-small">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} type="button" className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <input className="input" placeholder={kind === 'vaccine' ? 'اسم التطعيم (من الكارت)' : 'الدكتور أو سبب الزيارة'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} />
      <input className="input" placeholder="المكان (اختياري)" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={40} />
      <label className="field field-row">
        <span>الميعاد</span>
        <input className="input input-small" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" type="submit">
          ضيف
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
          خلاص
        </button>
      </div>
    </form>
  )
}

function AddItem() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [before, setBefore] = useState(true)

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    await db.babyItems.add({ name: name.trim(), price: Number(price) || 0, beforeBirth: before, bought: false })
    setName('')
    setPrice('')
  }

  return (
    <form className="add-task" onSubmit={save}>
      <div className="row">
        <input className="input" placeholder="ضيف حاجة…" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <input className="input input-small" type="number" inputMode="numeric" placeholder="السعر" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <label className="field field-row">
        <span>لازم قبل الولادة؟</span>
        <input type="checkbox" className="switch" checked={before} onChange={(e) => setBefore(e.target.checked)} />
      </label>
      <button className="btn btn-wide" type="submit">
        <Icon name="plus" size={18} /> ضيف
      </button>
    </form>
  )
}
