// حديث اليوم في صفحة اليوم
import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { hadithOfDay } from '../lib/hadith.js'

export default function HadithCard({ dateK, onOpenLibrary }) {
  const [h, setH] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    setOpen(false)
    hadithOfDay(dateK)
      .then((x) => alive && setH(x))
      .catch(() => alive && setH(null))
    return () => {
      alive = false
    }
  }, [dateK])
  if (!h) return null
  const long = h.text.length > 320
  return (
    <section className={`card hadith-card ${open ? 'is-open' : ''}`}>
      <div className="row-between">
        <span className="eyebrow">حديث اليوم</span>
        <button className="link-btn" onClick={onOpenLibrary}>
          المكتبة <Icon name="chevronLeft" size={16} />
        </button>
      </div>
      <p className="hadith-text">{h.text}</p>
      <div className="row-between">
        <small className="muted">
          {h.book} — {h.chapter}
        </small>
        {long && (
          <button className="link-btn" onClick={() => setOpen(!open)}>
            {open ? 'أقل' : 'اقرا كامل'}
          </button>
        )}
      </div>
    </section>
  )
}
