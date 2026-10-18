import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Goals from '../components/Goals.jsx'
import BodyWeight from '../components/BodyWeight.jsx'
import BalanceReport from '../components/BalanceReport.jsx'
import { lessonTitle, summary as hifzSummary, todayPlan } from '../lib/hifz.js'
import { clientLedger, money, monthStats } from '../lib/work.js'
import { monthKey } from '../lib/dates.js'
import { daysLeft, goalProgress } from '../lib/goals.js'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { addDays, dateKey, fromKey, num, todayKey } from '../lib/dates.js'
import { FORMED_DAYS, STATUS, habitDefs, habitStats, indexChecks } from '../lib/habits.js'

const ASPECT_NAMES = { faith: 'العبادة', health: 'الصحة', work: 'المهام' }
const pct = (r) => (r === null || r === undefined ? '—' : `${num(Math.round(r * 100))}٪`)

export default function Progress({ settings, onOpenHifz, onOpenWork }) {
  const today = todayKey()
  const checks = useLiveQuery(() => db.checks.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.orderBy('order').toArray(), [])
  const hifz = useLiveQuery(() => db.hifzLessons.toArray(), [])
  const workData = useLiveQuery(async () => {
    const [clients, jobs, payments] = await Promise.all([db.clients.toArray(), db.jobs.toArray(), db.payments.toArray()])
    if (!clients.length) return null
    const ms = monthStats(monthKey(new Date()), clients, jobs, payments)
    const owed = clients.reduce((s, c) => s + clientLedger(c, jobs, payments).owed, 0)
    return { ms, owed }
  }, [])
  const [showAll, setShowAll] = useState(false)

  const data = useMemo(() => {
    if (!checks || !tasks) return null
    const byDate = indexChecks(checks)
    const habits = habitDefs(settings, tasks).map((d) => habitStats(d, byDate, settings.firstUse))
    // إزاي صليت في آخر ٣٠ يوم
    const from = dateKey(addDays(fromKey(today), -30))
    const prayerMix = { ontime: 0, mosque: 0, late: 0, qada: 0 }
    for (const c of checks) {
      if (!c.item.startsWith('prayer:') || c.date < from) continue
      const v = c.value === true || !c.value ? 'ontime' : c.value
      prayerMix[v] = (prayerMix[v] || 0) + 1
    }
    return { habits, prayerMix, balance: balanceFor(habits, tasks, today) }
  }, [checks, tasks, settings, today])

  if (!data || !goals || !hifz) return null
  const hs = hifzSummary(hifz)
  const hp = todayPlan(hifz, settings.hifzPace || 'everyOther')
  const { habits, balance, prayerMix } = data
  const prayerTotal = Object.values(prayerMix).reduce((a, b) => a + b, 0)
  const formed = habits.filter((h) => h.status === 'formed').length
  const bestNow = habits.reduce((m, h) => (h.current > m.current ? h : m), habits[0])
  const insights = buildInsights(habits, goals, balance)
  const groups = {}
  for (const h of habits) (groups[h.group] ||= []).push(h)
  const visibleGroups = showAll ? Object.entries(groups) : Object.entries(groups).slice(0, 3)

  return (
    <>
      <header className="page-head">
        <h1>تقدّمي</h1>
        <p className="muted">إنت وصلت فين، واتعودت على إيه، وناقصك إيه</p>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong>
            {num(formed)}
            <small>/{num(habits.length)}</small>
          </strong>
          <span>عادات اتكونت</span>
        </div>
        <div className="stat">
          <strong>{num(bestNow?.current || 0)}</strong>
          <span>أطول سلسلة شغالة</span>
        </div>
        <div className="stat">
          <strong>{pct(balance.overall7)}</strong>
          <span>التزام آخر ٧ أيام</span>
        </div>
      </div>

      <section className="card insights">
        <h2>ناقصني إيه؟</h2>
        {insights.length === 0 ? (
          <p className="muted">لسه بدري — بعد كام يوم من الاستخدام هيظهرلك هنا أضعف حاجات عندك.</p>
        ) : (
          <ul className="insight-list">
            {insights.map((i, k) => (
              <li key={k} className={`insight insight-${i.kind}`}>
                <span className="insight-dot" />
                <span>
                  <strong>{i.title}</strong>
                  <small>{i.text}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Goals goals={goals} />

      <button className="card card-action hifz-card" onClick={onOpenHifz}>
        <span className="card-icon">
          <Icon name="book" />
        </span>
        <span>
          <strong>حفظ القرآن: {num((Math.round(hs.ratio * 1000) / 10).toFixed(1))}٪</strong>
          <small>
            {hp.lesson
              ? `${num(hs.ayahs)} آية، ${num(hs.surahs)} سورة، ${hp.mode === 'new' ? `الجديد: ${lessonTitle(hp.lesson)}` : hp.mode === 'steady' ? 'النهارده تثبيت' : 'خلّصت النهارده ✓'}${hp.due.length ? `، ${num(hp.due.length)} تسميع` : ''}`
              : 'ابدأ من سورة الناس'}
          </small>
        </span>
        <Icon name="chevronLeft" size={18} />
      </button>

      <button className="card card-action hifz-card" onClick={onOpenWork}>
        <span className="card-icon">
          <Icon name="wallet" />
        </span>
        <span>
          <strong>شغلي الشهر ده: {workData ? money(workData.ms.earned) : '—'}</strong>
          <small>
            {workData
              ? `${workData.ms.videos.toLocaleString('ar-EG')} فيديو، ليك برّه ${money(workData.owed)}`
              : 'سجّل شغلك وفلوسك من هنا'}
          </small>
        </span>
        <Icon name="chevronLeft" size={18} />
      </button>

      <BodyWeight settings={settings} />

      <BalanceReport habits={habits} checks={checks} balance={balance} />

      <section className="card">
        <div className="row-between">
          <h2>عاداتي</h2>
          <span className="pill">العادة بتتكوّن في {num(FORMED_DAYS)} يوم</span>
        </div>
        {visibleGroups.map(([group, list]) => (
          <div key={group} className="habit-group">
            <span className="tasks-label">{group}</span>
            {group === 'الصلاة' && prayerTotal > 0 && (
              <div className="prayer-mix">
                {[
                  ['mosque', 'في المسجد'],
                  ['ontime', 'في وقتها'],
                  ['late', 'متأخرة'],
                  ['qada', 'قضاء'],
                ].map(([k, label]) => (
                  <span key={k} className={`mix mix-${k}`}>
                    <strong>{num(prayerMix[k] || 0)}</strong>
                    {label}
                  </span>
                ))}
              </div>
            )}
            <ul className="habits">
              {list.map((h) => (
                <HabitRow key={h.id} h={h} />
              ))}
            </ul>
          </div>
        ))}
        {Object.keys(groups).length > 3 && (
          <button className="btn btn-ghost btn-wide" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'أقل' : 'اعرض كل العادات'}
          </button>
        )}
      </section>
    </>
  )
}

function HabitRow({ h }) {
  const st = STATUS[h.status]
  return (
    <li className="habit">
      <div className="row-between">
        <span className="habit-name">{h.name}</span>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </div>
      <div className="habit-meta">
        <span title="الأيام المتتالية">
          <Icon name="flame" size={15} /> {num(h.current)} يوم
        </span>
        <span>أطول: {num(h.best)}</span>
        <span>قوتها: {num(Math.round(h.score * 100))}٪</span>
      </div>
      <div className="habit-viz">
        <span className="bar bar-thin" title={`فاضل ${h.toFormed} يوم`}>
          <span style={{ width: `${Math.min(1, h.current / FORMED_DAYS) * 100}%` }} />
        </span>
        <span className="dots" aria-label="آخر ١٤ يوم">
          {h.last14.map((d, i) => (
            <span key={i} className={`dotd ${d ? 'on' : ''}`} />
          ))}
        </span>
      </div>
    </li>
  )
}

// نسبة كل جانب في آخر ٧ و٣٠ يوم
function balanceFor(habits, tasks, today) {
  const avg = (arr, key) => {
    const vals = arr.map((h) => h[key]).filter((v) => v !== null && v !== undefined)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  const onceRate = (n) => {
    const from = dateKey(addDays(fromKey(today), -n))
    const due = tasks.filter((t) => t.kind === 'once' && t.date >= from && t.date < today)
    return due.length ? due.filter((t) => t.done).length / due.length : null
  }
  const out = {}
  for (const a of ['faith', 'health']) {
    const hs = habits.filter((h) => h.aspect === a)
    out[a] = { r7: avg(hs, 'rate7'), r30: avg(hs, 'rate30') }
  }
  const wh = habits.filter((h) => h.aspect === 'work')
  const mix = (x, y) => (x === null ? y : y === null ? x : (x + y) / 2)
  out.work = { r7: mix(avg(wh, 'rate7'), onceRate(7)), r30: mix(avg(wh, 'rate30'), onceRate(30)) }
  const vals7 = Object.values(out).map((v) => v.r7).filter((v) => v !== null)
  out.overall7 = vals7.length ? vals7.reduce((s, v) => s + v, 0) / vals7.length : null
  return out
}

// أهم ٤ حاجات ناقصاك دلوقتي
function buildInsights(habits, goals, balance) {
  const out = []
  // متفوتهاش مرتين ورا بعض
  for (const h of habits.filter((h) => h.missedYesterdayOnly).slice(0, 2)) {
    out.push({ kind: 'twice', title: h.name, text: 'فاتتك امبارح بس — النهارده متفوتهاش، عشان السلسلة ما تقعش' })
  }
  const weak = habits
    .filter((h) => !h.missedYesterdayOnly && h.window7 >= 3 && h.rate7 !== null && h.rate7 < 0.8)
    .sort((a, b) => a.rate7 - b.rate7 || b.misses7 - a.misses7)
    .slice(0, 3)
  for (const h of weak) {
    out.push({
      kind: 'habit',
      title: h.name,
      text: `فاتتك ${num(h.misses7)} مرة من آخر ${num(h.window7)} أيام`,
    })
  }
  const slipped = habits.find((h) => h.status === 'slipped')
  if (slipped && !weak.includes(slipped)) {
    out.push({ kind: 'habit', title: slipped.name, text: `كانت متكونة (${num(slipped.best)} يوم) ووقعت، رجّعها النهارده` })
  }
  for (const g of goals.filter((g) => g.status === 'paused').slice(0, 2)) {
    out.push({ kind: 'goal', title: g.title, text: 'بدأته وسبته — تكمّله ولا تشيله؟' })
  }
  for (const g of goals.filter((g) => !g.done && g.status !== 'paused' && g.status !== 'done')) {
    const left = daysLeft(g)
    const p = goalProgress(g)
    if (!g.targetDate) {
      out.push({ kind: 'goal', title: g.title, text: 'حدد له معاد وقسّمه لخطوات عشان تعرف إنت فين' })
    } else if (left !== null && left <= 45 && p < 1) {
      out.push({
        kind: 'goal',
        title: g.title,
        text: left >= 0 ? `فاضل ${num(left)} يوم وخلصت ${num(Math.round(p * 100))}٪ بس` : 'المعاد عدّى — حدد معاد جديد',
      })
    } else if (!(g.steps || []).length) {
      out.push({ kind: 'goal', title: g.title, text: 'قسّمه لخطوات صغيرة' })
    }
  }
  const aspects = ['faith', 'health', 'work'].filter((a) => balance[a].r7 !== null)
  if (aspects.length >= 2) {
    const low = aspects.reduce((m, a) => (balance[a].r7 < balance[m].r7 ? a : m), aspects[0])
    if (balance[low].r7 < 0.6) {
      out.push({ kind: 'balance', title: `الميزان مايل بعيد عن ${ASPECT_NAMES[low]}`, text: `${pct(balance[low].r7)} بس في آخر ٧ أيام` })
    }
  }
  return out.slice(0, 5)
}
