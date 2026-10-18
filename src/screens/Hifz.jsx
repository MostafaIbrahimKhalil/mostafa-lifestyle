import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { num } from '../lib/dates.js'
import QURAN from '../data/quran-index.json'
import { HIFZ_STATUS, SURAH, hifzSummary, nextHifz } from '../lib/hifz.js'

export default function Hifz() {
  const rows = useLiveQuery(() => db.hifz.toArray(), [])
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const [pickStatus, setPickStatus] = useState('memorized')
  const [open, setOpen] = useState(null)
  const [showAllMem, setShowAllMem] = useState(false)
  if (!rows) return null

  const sum = hifzSummary(rows)
  const next = nextHifz(rows)
  const have = new Set(rows.map((r) => r.surah))
  const groups = ['learning', 'todo', 'paused', 'memorized'].map((st) => ({
    st,
    list: rows
      .filter((r) => r.status === st)
      .sort((a, b) => (st === 'memorized' ? b.surah - a.surah : a.priority - b.priority || a.surah - b.surah)),
  }))

  async function add(e) {
    e.preventDefault()
    const n = Number(pick)
    if (!n || have.has(n)) return
    await db.hifz.put({
      surah: n,
      status: pickStatus,
      reached: pickStatus === 'memorized' ? SURAH[n].ayahs : 0,
      priority: 2,
      updatedAt: new Date().toISOString(),
    })
    setPick('')
    setAdding(true)
  }

  // إضافة جزء عمّ كله مرة واحدة
  async function addJuzAmma(status) {
    const list = QURAN.surahs.filter((s) => s.n >= 78 && !have.has(s.n))
    await db.hifz.bulkPut(
      list.map((s) => ({
        surah: s.n,
        status,
        reached: status === 'memorized' ? s.ayahs : 0,
        priority: 2,
        updatedAt: new Date().toISOString(),
      })),
    )
    setAdding(true)
  }

  return (
    <>
      <header className="page-head">
        <h1>حفظ القرآن</h1>
        <p className="muted">إنت حافظ إيه، وبتحفظ في إيه، وتكمّل إيه الأول</p>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong>{num((Math.round(sum.ratio * 1000) / 10).toFixed(1))}٪</strong>
          <span>من القرآن</span>
        </div>
        <div className="stat">
          <strong>{num(sum.ayahs)}</strong>
          <span>آية حافظها</span>
        </div>
        <div className="stat">
          <strong>{num(sum.memorized)}</strong>
          <span>سورة كاملة</span>
        </div>
      </div>

      {next && (
        <section className="card next-hifz">
          <span className="tasks-label">كمّل دي الأول</span>
          <HifzRow r={next} open={open === next.surah} onToggle={() => setOpen(open === next.surah ? null : next.surah)} />
        </section>
      )}

      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.st} className="card">
            <div className="row-between">
              <h2>{HIFZ_STATUS[g.st].label}</h2>
              <span className="pill">{num(g.list.length)}</span>
            </div>
            <ul className="habits">
              {(g.st === 'memorized' && !showAllMem ? g.list.slice(0, 5) : g.list).map((r) => (
                <li key={r.surah}>
                  <HifzRow r={r} open={open === r.surah} onToggle={() => setOpen(open === r.surah ? null : r.surah)} />
                </li>
              ))}
            </ul>
            {g.st === 'memorized' && g.list.length > 5 && (
              <button className="btn btn-ghost btn-wide" onClick={() => setShowAllMem(!showAllMem)}>
                {showAllMem ? 'أقل' : `اعرض الـ ${num(g.list.length)} سورة`}
              </button>
            )}
          </section>
        ))}

      <section className="card">
        <h2>ضيف سورة</h2>
        {rows.length === 0 && (
          <p className="muted">ابدأ بالسور اللي حافظها، وبعدين اللي بتحفظ فيها أو سبتها في النص.</p>
        )}
        {adding || rows.length === 0 ? (
          <form className="add-task" onSubmit={add}>
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="السورة">
              <option value="">اختار السورة…</option>
              {QURAN.surahs
                .filter((s) => !have.has(s.n))
                .map((s) => (
                  <option key={s.n} value={s.n}>
                    {num(s.n)}. {s.name} ({num(s.ayahs)} آية)
                  </option>
                ))}
            </select>
            <div className="seg" role="radiogroup" aria-label="الحالة">
              {['memorized', 'learning', 'paused', 'todo'].map((st) => (
                <button key={st} type="button" className={pickStatus === st ? 'is-on' : ''} onClick={() => setPickStatus(st)}>
                  {HIFZ_STATUS[st].label.replace(' ✓', '')}
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn" type="submit">
                ضيف
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => addJuzAmma('memorized')}>
                جزء عمّ كله حافظه
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost btn-wide" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} />
            ضيف سورة
          </button>
        )}
      </section>
    </>
  )
}

function HifzRow({ r, open, onToggle }) {
  const sm = SURAH[r.surah]
  const reached = r.status === 'memorized' ? sm.ayahs : r.reached || 0
  const p = reached / sm.ayahs
  const st = HIFZ_STATUS[r.status]
  const update = (patch) => db.hifz.update(r.surah, { ...patch, updatedAt: new Date().toISOString() })

  return (
    <div className="hifz">
      <button className="row-between link-row" onClick={onToggle} aria-expanded={open}>
        <span className="habit-name">
          {sm.name} <small className="muted">({num(sm.ayahs)} آية)</small>
        </span>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </button>
      {r.status !== 'memorized' && (
        <div className="habit-viz">
          <span className="bar bar-thin">
            <span style={{ width: `${p * 100}%` }} />
          </span>
          <small className="muted">
            {reached ? `وصلت للآية ${num(reached)}` : 'لسه ما بدأتش'}
          </small>
        </div>
      )}
      {open && (
        <div className="goal-edit">
          {r.status !== 'memorized' && (
            <div className="stepper">
              <span>وصلت للآية</span>
              <button className="icon-btn" onClick={() => update({ reached: Math.max(0, reached - 1) })} aria-label="أقل">
                −
              </button>
              <input
                className="input input-small"
                type="number"
                inputMode="numeric"
                min="0"
                max={sm.ayahs}
                value={reached}
                onChange={(e) => update({ reached: Math.max(0, Math.min(sm.ayahs, Number(e.target.value) || 0)) })}
              />
              <button
                className="icon-btn"
                onClick={() => {
                  const n = Math.min(sm.ayahs, reached + 3)
                  update(n >= sm.ayahs ? { reached: n, status: 'memorized' } : { reached: n, status: 'learning' })
                }}
                aria-label="زوّد ٣ آيات"
              >
                +٣
              </button>
            </div>
          )}
          <div className="seg" role="radiogroup" aria-label="الحالة">
            {['learning', 'paused', 'todo', 'memorized'].map((s) => (
              <button
                key={s}
                type="button"
                className={r.status === s ? 'is-on' : ''}
                onClick={() => update(s === 'memorized' ? { status: s, reached: sm.ayahs } : { status: s })}
              >
                {HIFZ_STATUS[s].label.replace(' ✓', '')}
              </button>
            ))}
          </div>
          {r.status !== 'memorized' && (
            <div className="seg" role="radiogroup" aria-label="الأولوية">
              {[
                [1, 'أولًا'],
                [2, 'عادي'],
                [3, 'بعدين'],
              ].map(([v, label]) => (
                <button key={v} type="button" className={r.priority === v ? 'is-on' : ''} onClick={() => update({ priority: v })}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            className="link-btn"
            onClick={() => window.confirm(`تشيل سورة ${sm.name} من القايمة؟`) && db.hifz.delete(r.surah)}
          >
            شيلها من القايمة
          </button>
        </div>
      )}
    </div>
  )
}
