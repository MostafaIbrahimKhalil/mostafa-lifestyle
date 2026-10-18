import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setSetting } from '../db.js'
import { num, todayKey } from '../lib/dates.js'

const BASE_PHRASES = [
  'سبحان الله',
  'الحمد لله',
  'الله أكبر',
  'لا إله إلا الله',
  'أستغفر الله',
  'اللهم صلِّ على سيدنا محمد',
  'سبحان الله وبحمده',
  'لا حول ولا قوة إلا بالله',
]

const TARGETS = [33, 100, 1000, 0]

export default function Tasbih({ settings }) {
  const today = todayKey()
  const custom = settings.customPhrases || []
  const phrases = [...BASE_PHRASES, ...custom]
  const [phrase, setPhrase] = useState(settings.lastPhrase || phrases[0])
  const [target, setTarget] = useState(settings.tasbihTarget ?? 100)
  const [adding, setAdding] = useState(false)
  const [newPhrase, setNewPhrase] = useState('')

  const rows = useLiveQuery(() => db.tasbih.where('date').equals(today).toArray(), [today]) || []
  const id = `${today}|${phrase}`
  const count = rows.find((r) => r.id === id)?.count || 0
  const reached = target > 0 && count > 0 && count % target === 0

  async function tap() {
    navigator.vibrate?.(count + 1 === target ? [20, 40, 20] : 8)
    // قراءة وكتابة في نفس العملية عشان الضغط السريع ما يضيعش ولا تسبيحة
    await db.transaction('rw', db.tasbih, async () => {
      const row = await db.tasbih.get(id)
      await db.tasbih.put({ id, date: today, phrase, count: (row?.count || 0) + 1 })
    })
  }

  async function reset() {
    if (count === 0) return
    if (!window.confirm(`تصفّر عدّاد "${phrase}" النهارده؟`)) return
    await db.tasbih.delete(id)
  }

  async function pick(p) {
    setPhrase(p)
    await setSetting('lastPhrase', p)
  }

  async function pickTarget(t) {
    setTarget(t)
    await setSetting('tasbihTarget', t)
  }

  async function addPhrase(e) {
    e.preventDefault()
    const clean = newPhrase.trim()
    if (!clean || phrases.includes(clean)) return
    await setSetting('customPhrases', [...custom, clean])
    setNewPhrase('')
    setAdding(false)
    pick(clean)
  }

  const progress = target > 0 ? ((count % target) || (count ? target : 0)) / target : 0
  const totalToday = rows.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <header className="page-head">
        <h1>التسبيح</h1>
        <p className="muted">النهارده: {num(totalToday)} تسبيحة</p>
      </header>

      <div className="phrase-scroll" role="radiogroup" aria-label="الذكر">
        {phrases.map((p) => (
          <button key={p} className={`chip ${p === phrase ? 'chip-on' : ''}`} onClick={() => pick(p)}>
            {p}
          </button>
        ))}
        <button className="chip" onClick={() => setAdding(true)} aria-label="ضيف ذكر">
          <Icon name="plus" size={15} />
        </button>
      </div>

      {adding && (
        <form className="card add-task" onSubmit={addPhrase}>
          <input
            className="input"
            placeholder="اكتب الذكر…"
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            autoFocus
            maxLength={60}
          />
          <div className="row">
            <button className="btn" type="submit">
              ضيف
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setAdding(false)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <button className={`tasbih-big ${reached ? 'is-reached' : ''}`} onClick={tap} aria-label={`سبّح: ${phrase}`}>
        <svg viewBox="0 0 200 200" className="tasbih-ring" aria-hidden="true">
          <circle cx="100" cy="100" r="90" className="tr-bg" />
          {target > 0 && (
            <circle
              cx="100"
              cy="100"
              r="90"
              className="tr-fg"
              strokeDasharray={`${progress * 565.5} 565.5`}
              transform="rotate(-90 100 100)"
            />
          )}
        </svg>
        <span className="tasbih-big-inner">
          <span className="tasbih-phrase">{phrase}</span>
          <span className="tasbih-count">{num(count)}</span>
          {target > 0 && (
            <span className="tasbih-of">
              {reached ? `كمّلت ${num(target)} ✓` : `الهدف ${num(target)}`}
            </span>
          )}
        </span>
      </button>

      <div className="row-between">
        <div className="seg seg-small" role="radiogroup" aria-label="الهدف">
          {TARGETS.map((t) => (
            <button key={t} className={target === t ? 'is-on' : ''} onClick={() => pickTarget(t)}>
              {t ? num(t) : 'من غير هدف'}
            </button>
          ))}
        </div>
        <button className="link-btn" onClick={reset}>
          تصفير
        </button>
      </div>

      {rows.length > 0 && (
        <section className="card">
          <h2>تسبيح النهارده</h2>
          <ul className="totals">
            {rows
              .sort((a, b) => b.count - a.count)
              .map((r) => (
                <li key={r.id}>
                  <span>{r.phrase}</span>
                  <strong>{num(r.count)}</strong>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  )
}
