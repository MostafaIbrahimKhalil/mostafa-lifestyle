import { memo, useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/amiri-quran/arabic-400.css'
import Icon from '../components/Icon.jsx'
import { setCheck, setSetting } from '../db.js'
import { num } from '../lib/dates.js'
import QURAN from '../data/quran-index.json'
import { errorText, listen, makeFollower, normalize, speechSupported } from '../lib/recite.js'

const SURAH = Object.fromEntries(QURAN.surahs.map((s) => [s.n, s]))
const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'
const FONT_SIZES = [22, 25, 28, 32, 36]

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
          const next = { juz, s, a, at: new Date().toISOString() }
          setPos(next)
          setSetting('wirdPos', next)
        }, 600)
      },
      { root, rootMargin: '-90px 0px -70% 0px' },
    )
    root.querySelectorAll('[data-k]').forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [rows, juz])

  const idx = useMemo(() => {
    if (!rows || !pos) return 0
    const i = rows.findIndex((r) => r.s === pos.s && r.a === pos.a)
    return i < 0 ? 0 : i
  }, [rows, pos])
  const pct = rows ? Math.round(((idx + 1) / rows.length) * 100) : 0

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

  async function finish() {
    await setCheck(today, 'wird', true, juz)
    await setSetting('wirdNext', (juz % 30) + 1)
    await setSetting('wirdPos', null)
    onClose(true)
  }

  return (
    <div className="reader" role="dialog" aria-label={`الجزء ${juz}`}>
      <header className="reader-bar">
        <button className="icon-btn" onClick={() => onClose(false)} aria-label="رجوع">
          <Icon name="chevronRight" />
        </button>
        <div className="reader-title">
          <strong>الجزء {num(juz)}</strong>
          <small>
            {rows ? `صفحة ${num(page || rows[0].p)}، قريت ${num(pct)}٪` : 'بيفتح…'}
          </small>
        </div>
        <div className="reader-font">
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

      <div className="reader-body" ref={scroller} style={{ '--qfs': `${FONT_SIZES[fontIdx]}px` }}>
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

      {rows && speechSupported() && (
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
