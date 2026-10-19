import { memo, useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/amiri-quran/arabic-400.css'
import Icon from '../components/Icon.jsx'
import { db, setCheck, setSetting } from '../db.js'
import { num } from '../lib/dates.js'
import QURAN from '../data/quran-index.json'
import { errorText, listen, makeFollower, normalize, speechSupported } from '../lib/recite.js'

const SURAH = Object.fromEntries(QURAN.surahs.map((s) => [s.n, s]))
const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'
const FONT_SIZES = [22, 25, 28, 32, 36]
// سرعات التمرير التلقائي (بكسل في الثانية عند خط ٢٨) — الخط الأكبر بيمشي أسرع بنفس النسبة
const PROMPT_SPEEDS = [8, 12, 16, 21, 27, 34, 42, 52, 64]

// قيمة رقمية في علامات اليوم (بنقرا ونكتب في نفس العملية)
async function bumpCheck(date, item, fn) {
  await db.transaction('rw', db.checks, async () => {
    const cur = (await db.checks.get(`${date}|${item}`))?.value || 0
    const next = fn(Number(cur) || 0)
    if (next !== cur) await db.checks.put({ id: `${date}|${item}`, date, item, value: next, at: new Date().toISOString() })
  })
}

export function loadJuz(juz) {
  const n = String(juz).padStart(2, '0')
  return fetch(`${import.meta.env.BASE_URL}data/quran/juz-${n}.json`).then((r) => {
    if (!r.ok) throw new Error('ما قدرناش نفتح الجزء')
    return r.json()
  })
}

// قارئ الورد: بيفتح الجزء، ويفتكر آخر آية وقفت عندها، وفي الآخر "خلّصت الجزء"
export default function QuranReader({ juz, today, settings, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [pos, setPos] = useState(() => (settings.wirdPos?.juz === juz ? settings.wirdPos : null))
  const fontIdx = settings.quranFont ?? 2
  const scroller = useRef(null)
  const restored = useRef(false)

  useEffect(() => {
    let alive = true
    loadJuz(juz)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [juz])

  // نرجع لآخر آية كنت واقف عندها
  useEffect(() => {
    if (!rows || restored.current) return
    restored.current = true
    if (pos) {
      const el = scroller.current?.querySelector(`[data-k="${pos.s}:${pos.a}"]`)
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
    }
  }, [rows, pos])

  // نسبة اللي اتقرا: بطول النص مش بعدد الآيات (الآيات مختلفة في الطول)
  const cum = useMemo(() => {
    if (!rows) return null
    const total = rows.reduce((s, r) => s + r.t.length, 0)
    let acc = 0
    return rows.map((r) => {
      const before = acc / total
      acc += r.t.length
      return before
    })
  }, [rows])
  const cumRef = useRef(null)
  cumRef.current = cum

  // بنتابع أول آية ظاهرة على الشاشة ونحفظها
  useEffect(() => {
    if (!rows || !scroller.current) return
    const root = scroller.current
    let timer = null
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (!visible.length) return
        const [s, a] = visible[0].target.dataset.k.split(':').map(Number)
        clearTimeout(timer)
        timer = setTimeout(() => {
          const i = rows.findIndex((r) => r.s === s && r.a === a)
          const pct = cumRef.current && i >= 0 ? Math.round(cumRef.current[i] * 100) : null
          const next = { juz, s, a, pct, at: new Date().toISOString() }
          setPos(next)
          setSetting('wirdPos', next)
          // أعلى نسبة وصلتلها النهارده (للرسمة والإحصائيات)
          if (pct != null) bumpCheck(today, 'wird:pct', (cur) => Math.max(cur, pct))
        }, 600)
      },
      { root, rootMargin: '-90px 0px -70% 0px' },
    )
    root.querySelectorAll('[data-k]').forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [rows, juz, today])

  // وقت القراية: كل ٣٠ ثانية والصفحة قدامك بتتحسب
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') bumpCheck(today, 'quran:sec', (cur) => cur + 30)
    }, 30000)
    return () => clearInterval(t)
  }, [today])

  const idx = useMemo(() => {
    if (!rows || !pos) return 0
    const i = rows.findIndex((r) => r.s === pos.s && r.a === pos.a)
    return i < 0 ? 0 : i
  }, [rows, pos])
  const pct = rows && cum ? Math.round(cum[idx] * 100) : 0
  const voiceOn = !!settings.quranVoice

  // ===== القراية بصوتك: النص باهت ٥٠٪ والكلمة اللي بتقراها بتنوّر =====
  // كل كلمة ليها رقم (data-w) — بنلوّن بالـ DOM مباشرة عشان الجزء فيه آلاف الكلمات
  const words = useMemo(() => {
    if (!rows) return null
    let i = 0
    const perRow = rows.map((r) =>
      r.t.split(' ').map((raw) => {
        const n = normalize(raw)
        return { raw, n, i: n ? i++ : -1 }
      }),
    )
    const expected = perRow.flat().filter((w) => w.n).map((w) => w.n)
    const firstOfRow = perRow.map((ws) => ws.find((w) => w.i >= 0)?.i ?? 0)
    return { perRow, expected, firstOfRow }
  }, [rows])
  const [follow, setFollow] = useState(null) // null | 'on' | 'paused'
  const [followErr, setFollowErr] = useState(null)
  const follower = useRef(null)
  const painted = useRef(0)
  const stopRef = useRef(null)

  useEffect(() => () => stopRef.current?.(), [])

  function paint(c) {
    const root = scroller.current
    if (!root) return
    const from = painted.current
    if (c > from) for (let i = from; i < c; i++) root.querySelector(`[data-w="${i}"]`)?.classList.add('rd')
    else for (let i = c; i < from; i++) root.querySelector(`[data-w="${i}"]`)?.classList.remove('rd')
    painted.current = c
    const el = root.querySelector(`[data-w="${Math.max(0, c - 1)}"]`)
    if (el && c > from) {
      const r = el.getBoundingClientRect()
      const h = root.clientHeight
      if (r.top > h * 0.62 || r.top < 80) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  function startFollow() {
    setFollowErr(null)
    if (!follower.current) {
      const start = words.firstOfRow[idx] || 0
      follower.current = makeFollower(words.expected, start)
      painted.current = start
      // اللي قبل مكان البداية يتحسب مقروء
      for (let i = 0; i < start; i++) scroller.current?.querySelector(`[data-w="${i}"]`)?.classList.add('rd')
    } else follower.current.restart()
    scroller.current?.querySelector('.juz-text')?.classList.add('follow')
    try {
      stopRef.current = listen({
        onText: (_full, fin, interim) => paint(follower.current.feed(fin, interim)),
        onError: (code) => {
          setFollowErr(errorText(code))
          setFollow('paused')
        },
        onEnd: () => setFollow((f) => (f === 'on' ? 'paused' : f)),
      })
      setFollow('on')
    } catch (e) {
      setFollowErr(errorText(e.name || 'start'))
    }
  }

  function stopFollow() {
    stopRef.current?.()
    stopRef.current = null
    setFollow('paused')
  }

  function exitFollow() {
    stopFollow()
    scroller.current?.querySelector('.juz-text')?.classList.remove('follow')
    setFollow(null)
  }
  const page = rows?.[idx]?.p

  // ===== التمرير التلقائي زي التيليبرومبتر: الكلام بيطلع لمستوى عينك لوحده =====
  const [prompt, setPrompt] = useState(null) // null | 'on' | 'paused'
  const speedIdx = Math.min(PROMPT_SPEEDS.length - 1, Math.max(0, settings.promptSpeed ?? 3))
  const speedRef = useRef(0)
  speedRef.current = PROMPT_SPEEDS[speedIdx] * (FONT_SIZES[fontIdx] / 28)
  const holdRef = useRef(false)

  useEffect(() => {
    if (prompt !== 'on') return
    const el = scroller.current
    if (!el) return
    let acc = el.scrollTop
    let last = performance.now()
    let raf
    const step = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      // وإنت ماسك الشاشة بصباعك: التمرير بيستناك، وبيكمل من المكان اللي سبته فيه
      if (holdRef.current) acc = el.scrollTop
      else {
        acc += speedRef.current * dt
        el.scrollTop = acc
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          setPrompt('paused')
          return
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const hold = () => {
      holdRef.current = true
    }
    const release = () => {
      setTimeout(() => {
        holdRef.current = false
      }, 350)
    }
    el.addEventListener('touchstart', hold, { passive: true })
    el.addEventListener('touchend', release, { passive: true })
    el.addEventListener('touchcancel', release, { passive: true })
    // الشاشة ما تطفيش وإنت بتقرا
    let lock = null
    let gone = false
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (gone ? l.release() : (lock = l)))
      .catch(() => {})
    return () => {
      gone = true
      cancelAnimationFrame(raf)
      el.removeEventListener('touchstart', hold)
      el.removeEventListener('touchend', release)
      el.removeEventListener('touchcancel', release)
      lock?.release().catch(() => {})
      holdRef.current = false
    }
  }, [prompt])

  function startPrompt() {
    if (follow) exitFollow()
    setPrompt('on')
  }
  const setSpeed = (i) => setSetting('promptSpeed', Math.min(PROMPT_SPEEDS.length - 1, Math.max(0, i)))

  async function finish() {
    await setCheck(today, 'wird', true, juz)
    await bumpCheck(today, 'wird:pct', () => 100)
    // خلّصت الجزء ٣٠ = ختمة
    if (juz === 30) await setSetting('khatmaCount', (settings.khatmaCount || 0) + 1)
    await setSetting('wirdNext', (juz % 30) + 1)
    await setSetting('wirdPos', null)
    onClose(true)
  }

  return (
    <div className={`reader ${prompt ? 'prompting' : ''}`} role="dialog" aria-label={`الجزء ${juz}`}>
      <header className="reader-bar">
        <button className="icon-btn" onClick={() => onClose(false)} aria-label="رجوع">
          <Icon name="chevronRight" />
        </button>
        <div className="reader-title">
          <strong>الجزء {num(juz)}</strong>
          <small>{rows ? `صفحة ${num(page || rows[0].p)}` : 'بيفتح…'}</small>
        </div>
        {rows && <span className="wird-pct">{num(pct)}٪</span>}
        <div className="reader-font">
          {speechSupported() && (
            <button
              className={`icon-btn ${voiceOn ? 'is-on-voice' : ''}`}
              onClick={() => {
                if (voiceOn) exitFollow()
                setSetting('quranVoice', !voiceOn)
              }}
              aria-label={voiceOn ? 'اقفل القراية بالصوت' : 'القراية بالصوت'}
              aria-pressed={voiceOn}
            >
              <Icon name="mic" size={18} />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setSetting('quranFont', Math.max(0, fontIdx - 1))}
            aria-label="صغّر الخط"
          >
            <span className="font-a small">أ−</span>
          </button>
          <button
            className="icon-btn"
            onClick={() => setSetting('quranFont', Math.min(FONT_SIZES.length - 1, fontIdx + 1))}
            aria-label="كبّر الخط"
          >
            <span className="font-a">أ+</span>
          </button>
        </div>
      </header>
      <span className="reader-progress">
        <span style={{ width: `${pct}%` }} />
      </span>

      {prompt && <div className="prompt-guide" aria-hidden="true" />}
      <div
        className="reader-body"
        ref={scroller}
        style={{ '--qfs': `${FONT_SIZES[fontIdx]}px` }}
        onClick={(e) => {
          // لمسة على الكلام: وقّف / كمّل
          if (prompt && !e.target.closest('button')) setPrompt(prompt === 'on' ? 'paused' : 'on')
        }}
      >
        {error && <p className="muted center">{error}. اتأكد إن النت شغال أول مرة بس.</p>}
        {!rows && !error && <p className="muted center">بيفتح الجزء…</p>}
        {rows && <JuzText rows={rows} words={words.perRow} />}
        {rows && (
          <div className="reader-end">
            <p className="muted center">صدق الله العظيم</p>
            <button className="btn btn-wide" onClick={finish}>
              <Icon name="check" size={20} />
              خلّصت الجزء {num(juz)}
            </button>
          </div>
        )}
      </div>

      {rows && speechSupported() && voiceOn && follow && (
        <div className={`follow-bar ${follow === 'on' ? 'is-on' : ''}`}>
          {followErr && <small className="late">{followErr}</small>}
          {follow === 'on' && <small>بسمعك… الكلمة اللي بتقراها بتنوّر</small>}
          <div className="row">
            {follow === 'on' ? (
              <button className="btn follow-btn" onClick={stopFollow}>
                <span className="rec-dot" /> وقّف
              </button>
            ) : (
              <button className="btn follow-btn" onClick={startFollow}>
                <Icon name="mic" size={20} /> {follow ? 'كمّل' : 'اقرا بصوتك'}
              </button>
            )}
            {follow === 'paused' && (
              <button className="btn btn-ghost" onClick={exitFollow}>
                النص كامل
              </button>
            )}
          </div>
        </div>
      )}
      {rows && !follow && (
        <div className="follow-bar prompt-bar">
          {prompt ? (
            <div className="prompt-ctl" role="group" aria-label="التمرير التلقائي">
              <button className="icon-btn" onClick={() => setPrompt(null)} aria-label="اقفل التمرير">
                <Icon name="close" size={18} />
              </button>
              <button className="icon-btn" onClick={() => setSpeed(speedIdx - 1)} disabled={speedIdx === 0} aria-label="أبطأ">
                <Icon name="minus" size={18} />
              </button>
              <span className="prompt-speed">
                <small>السرعة</small>
                <strong>{num(speedIdx + 1)}</strong>
              </span>
              <button
                className="icon-btn"
                onClick={() => setSpeed(speedIdx + 1)}
                disabled={speedIdx === PROMPT_SPEEDS.length - 1}
                aria-label="أسرع"
              >
                <Icon name="plus" size={18} />
              </button>
              <button
                className="btn prompt-play"
                onClick={() => setPrompt(prompt === 'on' ? 'paused' : 'on')}
                aria-label={prompt === 'on' ? 'وقّف' : 'كمّل'}
              >
                <Icon name={prompt === 'on' ? 'pause' : 'play'} size={20} />
              </button>
            </div>
          ) : (
            <div className="row">
              <button className="btn follow-btn" onClick={startPrompt}>
                <Icon name="play" size={18} /> ابدأ
              </button>
              {speechSupported() && voiceOn && (
                <button className="btn btn-ghost follow-btn" onClick={startFollow}>
                  <Icon name="mic" size={18} /> اقرا بصوتك
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const JuzText = memo(function JuzText({ rows, words }) {
  // نقسّم الآيات لمجموعات: رأس سورة، بسملة، علامة صفحة، وفقرة آيات
  const rowIndex = new Map(rows.map((r, i) => [r, i]))
  const groups = []
  let para = null
  let lastPage = null
  for (const r of rows) {
    if (r.a === 1) {
      groups.push({ kind: 'head', s: r.s })
      if (r.s !== 1 && r.s !== 9) groups.push({ kind: 'basmala', s: r.s })
      para = null
    }
    if (lastPage !== null && r.p !== lastPage) {
      groups.push({ kind: 'page', p: r.p })
      para = null
    }
    lastPage = r.p
    if (!para) {
      para = { kind: 'text', ayahs: [] }
      groups.push(para)
    }
    para.ayahs.push(r)
  }

  return (
    <div className="juz-text">
      {groups.map((g) => {
        if (g.kind === 'head') {
          const sm = SURAH[g.s]
          return (
            <div key={`h${g.s}`} className="surah-head">
              <span className="surah-name">سورة {sm.name}</span>
              <small>
                {sm.type}، {num(sm.ayahs)} آية
              </small>
            </div>
          )
        }
        if (g.kind === 'basmala')
          return (
            <p key={`b${g.s}`} className="basmala">
              {BASMALA}
            </p>
          )
        if (g.kind === 'page')
          return (
            <div key={`p${g.p}`} className="page-mark">
              <span>صفحة {num(g.p)}</span>
            </div>
          )
        const first = g.ayahs[0]
        return (
          <p key={`t${first.s}-${first.a}`} className="quran-text">
            {g.ayahs.map((r) => (
              <span key={`${r.s}:${r.a}`} data-k={`${r.s}:${r.a}`} className="ayah">
                {words[rowIndex.get(r)].map((w, k) => (
                  <span key={k} className={w.i >= 0 ? 'w' : undefined} data-w={w.i >= 0 ? w.i : undefined}>
                    {w.raw}{' '}
                  </span>
                ))}
                <span className="ayah-no">{num(r.a)}</span>
                {r.sj ? (
                  <span className="sajda" title="سجدة">
                    ۩
                  </span>
                ) : null}{' '}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
})
