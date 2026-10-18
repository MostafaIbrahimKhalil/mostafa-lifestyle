import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import '@fontsource/amiri-quran/arabic-400.css'
import Icon from '../components/Icon.jsx'
import { db, setSetting } from '../db.js'
import { formatShortDate, fromKey, num, todayKey } from '../lib/dates.js'
import {
  INTERVALS,
  PLAN,
  SAME_DAY,
  STEPS,
  SURAH,
  bumpReps,
  juzOf,
  lessonTitle,
  markMemorized,
  markSteady,
  review,
  startLesson,
  summary,
  syncHifzCheck,
  todayPlan,
  toggleSameDay,
} from '../lib/hifz.js'
import { loadJuz } from './QuranReader.jsx'

const juzCache = new Map()
function getJuz(j) {
  if (!juzCache.has(j)) juzCache.set(j, loadJuz(j).catch((e) => (juzCache.delete(j), Promise.reject(e))))
  return juzCache.get(j)
}

function AyatText({ surah, from, to, hidden, onReveal }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let alive = true
    const js = [...new Set([juzOf(surah, from), juzOf(surah, to)])]
    Promise.all(js.map(getJuz))
      .then((all) => alive && setRows(all.flat().filter((r) => r.s === surah && r.a >= from && r.a <= to)))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [surah, from, to])
  if (!rows) return <p className="muted">بيفتح…</p>
  if (hidden)
    return (
      <button className="hidden-ayat" onClick={onReveal}>
        <Icon name="book" size={20} />
        النص مستخبي — سمّع، ولو احتجت دوس هنا تبص
      </button>
    )
  return (
    <p className="hifz-text">
      {from === 1 && surah !== 1 && surah !== 9 && <span className="hifz-basmala">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</span>}
      {rows.map((r) => (
        <span key={r.a}>
          {r.t} <span className="ayah-no">{num(r.a)}</span>{' '}
        </span>
      ))}
    </p>
  )
}

export default function Hifz({ settings }) {
  const today = todayKey()
  const rows = useLiveQuery(() => db.hifzLessons.toArray(), [])
  const pace = settings?.hifzPace || 'everyOther'
  const [hide, setHide] = useState(false)
  const [openReview, setOpenReview] = useState(null)

  useEffect(() => {
    if (rows) syncHifzCheck(today, pace)
  }, [rows, today, pace])

  if (!rows) return null
  const plan = todayPlan(rows, pace, today)
  const sum = summary(rows)
  const l = plan.lesson
  const nextUp = PLAN.slice((l?.id || 0), (l?.id || 0) + 3)
  const upcoming = rows
    .filter((r) => r.memorizedAt && r.nextReview > today)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    .slice(0, 5)

  return (
    <>
      <header className="page-head">
        <h1>حفظ القرآن</h1>
        <p className="muted">
          {pace === 'everyOther' ? '٣ آيات كل يومين: يوم حفظ ويوم تثبيت' : '٣ آيات كل يوم'}، من سورة الناس وطالع، ومراجعة بجدول
        </p>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong>{num(sum.ayahs)}</strong>
          <span>آية حافظها</span>
        </div>
        <div className="stat">
          <strong>{num(sum.surahs)}</strong>
          <span>سورة كاملة</span>
        </div>
        <div className="stat">
          <strong>{num((Math.round(sum.ratio * 1000) / 10).toFixed(1))}٪</strong>
          <span>من القرآن</span>
        </div>
      </div>

      {/* ===== الجديد / التثبيت ===== */}
      {l && (plan.mode === 'new' || plan.mode === 'doneToday') && (
        <section className={`card hifz-lesson ${plan.mode === 'doneToday' ? 'is-done' : ''}`}>
          <div className="row-between">
            <span className="tasks-label">{plan.mode === 'doneToday' ? 'حفظ النهارده ✓' : 'حفظ جديد النهارده'}</span>
            <span className="pill">درس {num(l.id)} من {num(PLAN.length)}</span>
          </div>
          <h2>{lessonTitle(l)}</h2>
          <AyatText surah={l.surah} from={l.from} to={l.to} hidden={hide && plan.mode === 'new'} onReveal={() => setHide(false)} />

          {plan.mode === 'new' && (
            <>
              <ol className="hifz-steps">
                {STEPS.map((s) => (
                  <li key={s.id}>
                    <strong>{s.title}</strong>
                    <small>{s.sub}</small>
                  </li>
                ))}
              </ol>
              <div className="rep-row">
                <button
                  className="rep-btn"
                  onClick={async () => {
                    await startLesson(l, today)
                    await bumpReps(l, 1)
                    navigator.vibrate?.(8)
                  }}
                >
                  <span className="rep-count">{num(l.reps || 0)}</span>
                  <span>تكرار — دوس مع كل مرة</span>
                </button>
                <span className="bar bar-thin">
                  <span style={{ width: `${Math.min(1, (l.reps || 0) / 20) * 100}%` }} />
                </span>
              </div>
              <div className="row">
                <button className="btn btn-ghost" onClick={() => setHide(!hide)}>
                  {hide ? 'اظهر النص' : 'خبّي النص وسمّع'}
                </button>
                <button
                  className="btn"
                  onClick={async () => {
                    await markMemorized(l, today)
                    setHide(false)
                  }}
                >
                  <Icon name="check" size={18} />
                  حفظتها
                </button>
              </div>
            </>
          )}

          {plan.mode === 'doneToday' && (
            <>
              <p className="muted">تسميع النهارده عشان الحفظ يثبت:</p>
              <ul className="tasks">
                {SAME_DAY.map((s) => {
                  const done = (l.sameDay || []).includes(s.id)
                  return (
                    <li key={s.id} className={`task ${done ? 'is-done' : ''}`}>
                      <span className="task-title">
                        {s.title}
                        <small className="muted">{s.sub}</small>
                      </span>
                      <button
                        className={`check ${done ? 'is-done' : ''}`}
                        onClick={() => toggleSameDay(l, s.id)}
                        aria-pressed={done}
                        aria-label={s.title}
                      >
                        <Icon name="check" size={18} stroke={2.6} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {pace === 'everyOther' && <p className="muted">بكرة يوم تثبيت للآيات دي، والجديد بعد بكرة إن شاء الله.</p>}
            </>
          )}
        </section>
      )}

      {l && (plan.mode === 'steady' || plan.mode === 'steadyDone') && (
        <section className={`card hifz-lesson ${plan.mode === 'steadyDone' ? 'is-done' : ''}`}>
          <span className="tasks-label">{plan.mode === 'steadyDone' ? 'التثبيت ✓' : 'يوم تثبيت'}</span>
          <h2>{lessonTitle(l)}</h2>
          <p className="muted">
            مفيش جديد النهارده. سمّع اللي حفظته امبارح ٣ مرات متفرقة، واربطه باللي قبله، وصلّي بيه لو تقدر.
          </p>
          <AyatText surah={l.surah} from={l.from} to={l.to} hidden={hide} onReveal={() => setHide(false)} />
          {plan.mode === 'steady' && (
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setHide(!hide)}>
                {hide ? 'اظهر النص' : 'خبّي النص وسمّع'}
              </button>
              <button className="btn" onClick={() => markSteady(l, today)}>
                <Icon name="check" size={18} />
                ثبّتها
              </button>
            </div>
          )}
          {plan.mode === 'steadyDone' && nextUp[0] && (
            <p className="muted">الجديد بكرة: {lessonTitle(nextUp[0])}</p>
          )}
        </section>
      )}

      {!l && (
        <section className="card">
          <h2>ما شاء الله، ختمت الحفظ 🤍</h2>
          <p className="muted">كمّل المراجعة بالجدول.</p>
        </section>
      )}

      {/* ===== تسميع المراجعة ===== */}
      <section className="card">
        <div className="row-between">
          <h2>تسميع المراجعة النهارده</h2>
          <span className={`pill ${plan.due.length ? 'st-slipped' : 'pill-ok'}`}>
            {plan.due.length ? `${num(plan.due.length)} عليك` : 'خلصت ✓'}
          </span>
        </div>
        {plan.due.length === 0 && plan.reviewedToday.length === 0 && (
          <p className="muted">مفيش مراجعة النهارده. كل جزء بتحفظه بيرجعلك بعد ١، ٣، ٧، ١٤، ٣٠، ٦٠ يوم.</p>
        )}
        <ul className="jobs">
          {plan.due.map((r) => (
            <li key={r.id} className="job">
              <div className="row-between">
                <span className="tl-text">
                  <strong>{lessonTitle(r)}</strong>
                  <small>
                    مرحلة {num((r.intervalIdx || 0) + 1)} من {num(INTERVALS.length)}، حفظتها {formatShortDate(fromKey(r.memorizedAt))}
                  </small>
                </span>
                <button className="link-btn" onClick={() => setOpenReview(openReview === r.id ? null : r.id)}>
                  {openReview === r.id ? 'خبّي' : 'بُص'}
                </button>
              </div>
              {openReview === r.id && <AyatText surah={r.surah} from={r.from} to={r.to} />}
              <div className="row">
                <button className="btn btn-small" onClick={() => review(r, true, today)}>
                  سمّعتها صح ✓
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => review(r, false, today)}>
                  فيها غلطات
                </button>
              </div>
            </li>
          ))}
          {plan.reviewedToday.map((r) => (
            <li key={r.id} className="job is-done">
              <span className="tl-text">
                <strong>{lessonTitle(r)} ✓</strong>
                <small>الجاية {formatShortDate(fromKey(r.nextReview))}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <section className="card">
          <h2>مواعيد التسميع الجاية</h2>
          <ul className="totals">
            {upcoming.map((r) => (
              <li key={r.id}>
                <span>{lessonTitle(r)}</span>
                <strong>{formatShortDate(fromKey(r.nextReview))}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nextUp.length > 0 && (
        <section className="card">
          <h2>اللي جاي في الحفظ</h2>
          <ul className="totals">
            {nextUp.map((p) => (
              <li key={p.id}>
                <span>{lessonTitle(p)}</span>
                <small className="muted">{SURAH[p.surah].type}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>الطريقة</h2>
        <ul className="section-items">
          <li>القليل الدائم أحسن من الكتير المنقطع: ٣ آيات بإتقان أحسن من صفحة بتطير.</li>
          <li>احفظ بعد الفجر، وسمّع بعدها بساعة، وبعد الظهر أو العصر، وقبل النوم.</li>
          <li>صلّي باللي حفظته في السنن والفرايض — أقوى تثبيت.</li>
          <li>كل ما تخلص سورة، سمّعها كاملة من أولها لآخرها كذا مرة.</li>
          <li>اقرأ بصوت مسموع، ومن نفس المصحف دايمًا.</li>
        </ul>
        <label className="field field-row">
          <span>كل يوم بدل كل يومين</span>
          <input
            type="checkbox"
            className="switch"
            checked={pace === 'daily'}
            onChange={(e) => setSetting('hifzPace', e.target.checked ? 'daily' : 'everyOther')}
          />
        </label>
      </section>
    </>
  )
}
