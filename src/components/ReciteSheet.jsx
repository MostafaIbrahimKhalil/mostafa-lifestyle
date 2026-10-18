import { useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/amiri-quran/arabic-400.css'
import Icon from './Icon.jsx'
import { num } from '../lib/dates.js'
import { align, errorText, listen, speechSupported, splitWords } from '../lib/recite.js'

// تسميع بالصوت: النص مستخبي، تقرا، وفي الآخر الكلمات اللي اتقالت تنوّر أخضر واللي فاتت أحمر
export default function ReciteSheet({ title, rows, onClose, onResult }) {
  const [state, setState] = useState('idle') // idle | listening | done
  const [heard, setHeard] = useState('')
  const [error, setError] = useState(null)
  const stopRef = useRef(null)

  // كلمات كل آية لوحدها عشان نعرض رقم الآية
  const ayat = useMemo(() => rows.map((r) => ({ a: r.a, words: splitWords(r.t) })), [rows])
  const expected = useMemo(() => ayat.flatMap((x) => x.words), [ayat])
  const ok = useMemo(() => (state === 'done' ? align(expected, splitWords(heard)) : null), [state, expected, heard])
  const right = ok ? ok.filter(Boolean).length : 0

  useEffect(() => () => stopRef.current?.(), [])

  function start() {
    setError(null)
    setHeard('')
    try {
      stopRef.current = listen({
        onText: setHeard,
        onError: (code) => {
          setError(errorText(code))
          setState('idle')
        },
        onEnd: () => setState((s) => (s === 'listening' ? 'done' : s)),
      })
      setState('listening')
    } catch (e) {
      setError(errorText(e.name || 'start'))
    }
  }

  function stop() {
    stopRef.current?.()
    stopRef.current = null
    setState('done')
  }

  useEffect(() => {
    if (state === 'done' && ok) onResult?.(right / expected.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  let k = 0
  return (
    <div className="reader" role="dialog" aria-label="تسميع بالصوت">
      <header className="reader-bar">
        <button className="icon-btn" onClick={onClose} aria-label="رجوع">
          <Icon name="chevronRight" />
        </button>
        <div className="reader-title">
          <strong>سمّع بصوتك</strong>
          <small>{title}</small>
        </div>
        <span style={{ width: 40 }} />
      </header>
      <div className="reader-body recite">
        {!speechSupported() && (
          <p className="card muted">الموبايل ده مش بيدعم التعرف على الصوت من المتصفح. جرّب من سفاري على الآيفون.</p>
        )}

        {state !== 'done' && (
          <div className="card recite-card">
            <p className="muted">
              {state === 'idle'
                ? 'دوس على المايك واقرا الآيات من حفظك، بحدر شوية (من غير مد طويل) عشان الموبايل يلقط الكلام. ولما تخلص دوس "خلصت".'
                : 'بسمعك… كمّل لحد آخر آية'}
            </p>
            <button
              className={`mic-btn ${state === 'listening' ? 'is-on' : ''}`}
              onClick={state === 'listening' ? stop : start}
              disabled={!speechSupported()}
              aria-label={state === 'listening' ? 'خلصت' : 'ابدأ'}
            >
              <Icon name={state === 'listening' ? 'check' : 'mic'} size={34} />
            </button>
            <strong>{state === 'listening' ? 'خلصت' : 'ابدأ التسميع'}</strong>
            {heard && <p className="recite-heard">{heard}</p>}
            {error && <p className="late">{error}</p>}
          </div>
        )}

        {state === 'done' && (
          <>
            <div className={`card recite-score ${right / expected.length >= 0.9 ? 'good' : ''}`}>
              <strong>
                {num(right)} من {num(expected.length)} كلمة
              </strong>
              <span>
                {right === expected.length
                  ? 'ما شاء الله، مظبوطة ✓'
                  : right / expected.length >= 0.9
                    ? 'كويس جدًا. بص على الكلمات الحمرا'
                    : 'راجع الكلمات الحمرا وسمّع تاني'}
              </span>
            </div>
            <p className="hifz-text recite-text">
              {ayat.map((x) => (
                <span key={x.a}>
                  {x.words.map((w) => {
                    const i = k++
                    return (
                      <span key={i} className={ok[i] ? 'w-ok' : 'w-miss'}>
                        {w.raw}{' '}
                      </span>
                    )
                  })}
                  <span className="ayah-no">{num(x.a)}</span>{' '}
                </span>
              ))}
            </p>
            <p className="muted small">
              الأحمر يعني الموبايل ما سمعهاش: يا إما نسيتها، يا إما اتقالت بسرعة أو بمد. ده مساعد للتسميع، والتجويد والتشكيل محتاجين حد يسمعلك.
            </p>
            <div className="row">
              <button className="btn" onClick={start}>
                <Icon name="refresh" size={18} /> سمّع تاني
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                تمام
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
