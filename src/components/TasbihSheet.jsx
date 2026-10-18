import { useState } from 'react'
import { num } from '../lib/dates.js'

// تسبيح بعد الصلاة: ٣٣ + ٣٣ + ٣٤ = ١٠٠
const STEPS = [
  { text: 'سبحان الله', target: 33 },
  { text: 'الحمد لله', target: 33 },
  { text: 'الله أكبر', target: 34 },
]

export default function TasbihSheet({ title, onClose, onDone }) {
  const [step, setStep] = useState(0)
  const [count, setCount] = useState(0)
  const finished = step >= STEPS.length
  const current = STEPS[Math.min(step, STEPS.length - 1)]
  const totalSoFar = STEPS.slice(0, step).reduce((s, x) => s + x.target, 0) + (finished ? 0 : count)

  function tap() {
    if (finished) return
    navigator.vibrate?.(8)
    const next = count + 1
    if (next >= current.target) {
      setStep(step + 1)
      setCount(0)
    } else {
      setCount(next)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row-between">
          <h2>{title}</h2>
          <span className="pill">{num(totalSoFar)} / {num(100)}</span>
        </div>

        <div className="tasbih-steps">
          {STEPS.map((s, i) => (
            <span key={s.text} className={`tasbih-step ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`}>
              {s.text} {num(s.target)}
            </span>
          ))}
        </div>

        {finished ? (
          <div className="tasbih-finish">
            <p className="tasbih-final">
              لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير
            </p>
            <button className="btn btn-wide" onClick={onDone}>
              تمام، خلّصت
            </button>
          </div>
        ) : (
          <button className="tasbih-tap" onClick={tap} aria-label={`اضغط: ${current.text}`}>
            <span className="tasbih-phrase">{current.text}</span>
            <span className="tasbih-count">{num(count)}</span>
            <span className="tasbih-of">من {num(current.target)}</span>
          </button>
        )}

        <div className="row">
          {!finished && (
            <button className="btn btn-ghost" onClick={onDone}>
              علّم إني خلّصت
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            قفل
          </button>
        </div>
      </div>
    </div>
  )
}
