import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setCheck, setSetting } from '../db.js'
import { num } from '../lib/dates.js'
import ADHKAR from '../data/adhkar.json'

export const ADHKAR_TITLES = {
  morning: 'أذكار الصباح',
  evening: 'أذكار المساء',
  sleep: 'أذكار النوم',
}

// صفحة الأذكار: كل ذكر بعدّاده، تدوس عليه يعدّ، ولما الكل يخلص تتعلّم ✓ لوحدها
export default function AdhkarReader({ kind, today, onClose }) {
  const list = ADHKAR[kind]
  const key = `adhkarProgress:${today}:${kind}`
  const row = useLiveQuery(() => db.settings.get(key), [key])
  const progress = row?.value || {}
  const [openFadl, setOpenFadl] = useState(null)

  const doneCount = list.filter((x) => (progress[x.id] || 0) >= x.count).length
  const allDone = doneCount === list.length

  useEffect(() => {
    if (row !== undefined && allDone) setCheck(today, `adhkar:${kind}`, true)
  }, [allDone, row, today, kind])

  async function tap(x) {
    const cur = progress[x.id] || 0
    if (cur >= x.count) return
    navigator.vibrate?.(cur + 1 === x.count ? [15, 40, 15] : 8)
    // قراءة وكتابة في نفس العملية عشان الضغط السريع ما يضيعش
    await db.transaction('rw', db.settings, async () => {
      const latest = (await db.settings.get(key))?.value || {}
      await db.settings.put({ key, value: { ...latest, [x.id]: Math.min(x.count, (latest[x.id] || 0) + 1) } })
    })
  }

  async function reset(x) {
    await setSetting(key, { ...progress, [x.id]: 0 })
  }

  async function markAll() {
    await setSetting(key, Object.fromEntries(list.map((x) => [x.id, x.count])))
    await setCheck(today, `adhkar:${kind}`, true)
    onClose()
  }

  // أول ذكر لسه ما خلصش
  const firstOpen = list.find((x) => (progress[x.id] || 0) < x.count)

  return (
    <div className="reader" role="dialog" aria-label={ADHKAR_TITLES[kind]}>
      <header className="reader-bar">
        <button className="icon-btn" onClick={onClose} aria-label="رجوع">
          <Icon name="chevronRight" />
        </button>
        <div className="reader-title">
          <strong>{ADHKAR_TITLES[kind]}</strong>
          <small>
            {num(doneCount)} من {num(list.length)}
          </small>
        </div>
        <span style={{ width: 40 }} />
      </header>
      <span className="reader-progress">
        <span style={{ width: `${(doneCount / list.length) * 100}%` }} />
      </span>

      <div className="reader-body adhkar-body">
        {allDone && (
          <div className="card adhkar-done">
            <strong>خلّصت {ADHKAR_TITLES[kind]} ✓</strong>
            <button className="btn" onClick={onClose}>
              تمام
            </button>
          </div>
        )}
        {list.map((x) => {
          const c = progress[x.id] || 0
          const done = c >= x.count
          return (
            <article key={x.id} className={`dhikr ${done ? 'is-done' : ''} ${firstOpen === x ? 'is-next' : ''}`}>
              <button className="dhikr-tap" onClick={() => tap(x)} disabled={done} aria-label={`عدّ: ${x.text.slice(0, 30)}`}>
                {x.note && <span className="dhikr-note">{x.note}</span>}
                <span className="dhikr-text">{x.text}</span>
              </button>
              <div className="dhikr-foot">
                <span className={`dhikr-count ${done ? 'is-done' : ''}`}>
                  {done ? '✓' : `${num(c)} / ${num(x.count)}`}
                </span>
                {x.countText && !done && <small className="muted">{x.countText}</small>}
                <span className="dhikr-actions">
                  {(x.fadl || x.source) && (
                    <button className="link-btn" onClick={() => setOpenFadl(openFadl === x.id ? null : x.id)}>
                      {openFadl === x.id ? 'خبّي' : 'فضله'}
                    </button>
                  )}
                  {c > 0 && (
                    <button className="link-btn" onClick={() => reset(x)}>
                      من الأول
                    </button>
                  )}
                </span>
              </div>
              {openFadl === x.id && (
                <div className="dhikr-fadl">
                  {x.fadl && <p>{x.fadl}</p>}
                  {x.source && <small>{x.source}</small>}
                </div>
              )}
            </article>
          )
        })}
        {!allDone && (
          <button className="btn btn-ghost btn-wide" onClick={markAll}>
            قريتها كلها من غير العدّاد ✓
          </button>
        )}
        <p className="muted center sources">من كتاب حصن المسلم</p>
      </div>
    </div>
  )
}
