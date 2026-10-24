import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import QuickAddSheet from '../components/QuickAddSheet.jsx'
import HadithCard from '../components/HadithCard.jsx'
import Icon from '../components/Icon.jsx'
import { db, setCheck, setSetting } from '../db.js'
import { useNow } from '../hooks.js'
import { ITEM_ASPECT, buildDay, currentPrayer } from '../lib/day.js'
import { groupTasks } from '../lib/tasks.js'
import { remindersFor } from '../lib/reminders.js'
import { CheckButton, TaskItem } from '../components/TaskParts.jsx'
import {
  addDays,
  dateKey,
  formatDuration,
  formatGregorian,
  formatHijri,
  formatShortDate,
  formatTime,
  fromKey,
  greeting,
  logicalDate,
  minutesBetween,
  num,
  todayKey,
} from '../lib/dates.js'
import { isIOS, isStandalone } from '../lib/device.js'
import { getDeviceLocation } from '../lib/prayer.js'
import { WATER_TARGET } from '../lib/day.js'
import QuranReader from './QuranReader.jsx'
import AdhkarReader from './AdhkarReader.jsx'
import Workout from './Workout.jsx'
import { lessonTitle, todayPlan } from '../lib/hifz.js'
import { backupDue, shareBackup } from '../lib/backup.js'
import { postStage } from '../lib/plan.js'
import { zeinIdea } from '../data/zein.js'
import { isSunnahFastDay, tomorrowKey } from '../lib/water.js'

// من الخطة: فيديو نازل النهارده أو بكرة، ومواعيد الدكاترة والتطعيمات
function PlanToday({ today, isToday, onOpenSub }) {
  // النهارده بنوري بكرة كمان؛ أي يوم تاني بنوري اليوم ده بس
  const tomorrow = isToday ? dateKey(addDays(new Date(today + 'T12:00'), 1)) : today
  const data = useLiveQuery(async () => {
    const [posts, appts] = await Promise.all([
      db.posts.where('date').between(today, tomorrow, true, true).toArray(),
      isToday ? db.appts.where('date').belowOrEqual(tomorrow).toArray() : db.appts.where('date').equals(today).toArray(),
    ])
    return { posts, appts: appts.filter((a) => !a.done) }
  }, [today, tomorrow])
  if (!data || (!data.posts.length && !data.appts.length)) return null
  const when = (d) => (!isToday ? 'اليوم ده' : d === today ? 'النهارده' : d === tomorrow ? 'بكرة' : 'فات معاده')
  return (
    <section className="card plan-today">
      {data.posts.map((p) => {
        const st = postStage(p, today)
        return (
          <button key={`p${p.id}`} className="link-row plan-line" onClick={() => onOpenSub('posts')}>
            <Icon name="calendar" size={18} />
            <span className="tl-text">
              <strong>
                فيديو {when(p.date)}: {p.title}
              </strong>
              <small>{p.hook}</small>
            </span>
            <span className={`pill ${st.cls}`}>{st.label}</span>
          </button>
        )
      })}
      {data.appts.map((a) => (
        <button key={`a${a.id}`} className="link-row plan-line" onClick={() => onOpenSub('baby')}>
          <Icon name="heart" size={18} />
          <span className="tl-text">
            <strong>
              {when(a.date)}: {a.title}
            </strong>
            {a.place && <small>{a.place}</small>}
          </span>
          <Icon name="chevronLeft" size={16} />
        </button>
      ))}
    </section>
  )
}

export default function Today({ settings, onOpenTasks, onOpenAgenda, onOpenHifz, onOpenSub, jumpTo }) {
  const realNow = useNow()
  const [offset, setOffset] = useState(() =>
    jumpTo ? Math.round((fromKey(jumpTo) - fromKey(todayKey(realNow))) / 86400000) : 0,
  )
  const [quickAdd, setQuickAdd] = useState(false) // ٠ = النهارده، سالب = أيام فاتت، موجب = أيام جاية
  const isToday = offset === 0
  const isFuture = offset > 0
  const isPast = offset < 0
  const day = addDays(logicalDate(realNow), offset)
  const today = isToday ? todayKey(realNow) : dateKey(day)
  // يوم فات: اليوم كله خلص. يوم جاي: لسه ما بدأش
  const now = isToday ? realNow : isFuture ? day : addDays(day, 1)
  const dayLabel = offset === 0 ? 'النهارده' : offset === -1 ? 'امبارح' : offset === 1 ? 'بكرة' : formatShortDate(day)
  const [locMsg, setLocMsg] = useState(null)
  const [overlay, setOverlay] = useState(null) // { kind: 'quran'|'adhkar'|'gym', ... }

  const checks = useLiveQuery(() => db.checks.where('date').equals(today).toArray(), [today])
  const hifzRows = useLiveQuery(() => db.hifzLessons.toArray(), [])
  const hifzRow = useMemo(() => {
    if (!hifzRows) return {}
    const p = todayPlan(hifzRows, settings.hifzPace || 'everyOther', today)
    const due = p.due.length ? `، ${num(p.due.length)} تسميع مراجعة` : ''
    if (!p.lesson) return { title: 'مراجعة الحفظ', subtitle: due ? due.slice(2) : 'خلصت ✓' }
    if (p.mode === 'new') return { title: 'حفظ جديد', subtitle: `${lessonTitle(p.lesson)}${due}` }
    if (p.mode === 'steady') return { title: 'تثبيت الحفظ', subtitle: `${lessonTitle(p.lesson)}${due}` }
    return { title: 'الحفظ', subtitle: `حفظت ${lessonTitle(p.lesson)}${due || '، سمّعه بعد ساعة وقبل النوم'}` }
  }, [hifzRows, settings.hifzPace, today])
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])
  const tasbihToday = useLiveQuery(async () => (await db.tasbih.where('date').equals(today).toArray()).reduce((s, x) => s + x.count, 0), [today]) || 0

  const { rows, times } = buildDay(day, settings, { fasting: (checks || []).some((c) => c.item === 'fast:yes') })
  const checked = useMemo(() => new Map((checks || []).map((c) => [c.item, c])), [checks])
  const checkedSet = useMemo(() => new Set(checked.keys()), [checked])
  const g = useMemo(() => {
    const x = groupTasks(allTasks || [], today)
    // يوم جاي: مهام اليوم ده بس (المتأخرة بتظهر النهارده)
    if (isFuture) x.today = x.today.filter((t) => t.date === today)
    return x
  }, [allTasks, today, isFuture])

  const workTotal = g.daily.length + g.today.length
  const workDone = g.daily.filter((t) => checkedSet.has(`task:${t.id}`)).length + g.today.filter((t) => t.done).length
  const curPrayer = isToday ? currentPrayer(times, now) : null
  const excused = checkedSet.has('day:excused')
  const fasting = checkedSet.has('fast:yes')
  const tomorrowK = tomorrowKey(day)
  const tomorrowChecks = useLiveQuery(() => db.checks.where('date').equals(tomorrowK).toArray(), [tomorrowK])

  // أول بند لسه ما اتعلّمش ووقته جاي
  const next = isToday && rows.find((r) => !r.hideTime && r.time > now && !checkedSet.has(r.id))

  const toggle = (item, done, value) => setCheck(today, item, done, value)

  // كل كمية مية لوحدها، والمجموع بيتحسب منهم
  async function toggleWater(r, d) {
    await setCheck(today, r.id, d)
    const total = rows
      .filter((x) => x.type === 'water')
      .reduce((sum, x) => sum + ((x.id === r.id ? d : checkedSet.has(x.id)) ? x.cups : 0), 0)
    await setCheck(today, 'water:count', total > 0, total)
    await setCheck(today, 'water', total >= WATER_TARGET, total)
  }

  async function toggleWird(juz, done) {
    await setCheck(today, 'wird', done, juz)
    await setSetting('wirdNext', done ? (juz % 30) + 1 : juz)
  }

  async function locate() {
    setLocMsg('بنحدد مكانك…')
    try {
      const loc = await getDeviceLocation()
      await setSetting('location', loc)
      setLocMsg(null)
    } catch (err) {
      setLocMsg(err.message)
    }
  }

  if (!checks || !allTasks) return null

  return (
    <>
      <header className="hero">
        <p className="eyebrow">{greeting(now)}</p>
        <h1>{settings.name}</h1>
        <p className="dates">
          <span>{formatGregorian(day)}</span>
          <span className="dot" aria-hidden="true">|</span>
          <span>{formatHijri(day)}</span>
        </p>
      </header>

      <div className="day-nav" aria-label="اتنقل بين الأيام">
        <button className="icon-btn" onClick={() => setOffset(Math.max(-400, offset - 1))} aria-label="اليوم اللي قبله">
          <Icon name="chevronRight" />
        </button>
        <button className={`day-nav-label ${isToday ? 'is-today' : ''}`} onClick={() => setOffset(0)}>
          <strong>{dayLabel}</strong>
          {!isToday && <small>{offset < -1 || offset > 1 ? DAY_LABEL[day.getDay()] : formatShortDate(day)} — دوس للنهارده</small>}
        </button>
        <button className="icon-btn" onClick={() => setOffset(Math.min(400, offset + 1))} aria-label="اليوم اللي بعده">
          <Icon name="chevronLeft" />
        </button>
      </div>
      <DayStrip day={day} base={logicalDate(realNow)} onPick={setOffset} />
      <button className="link-btn agenda-link" onClick={onOpenAgenda}>
        <Icon name="calendar" size={16} /> النتيجة لحد آخر السنة
      </button>

      {offset < 0 && <p className="muted center">يوم فات — لو نسيت تعلّم حاجة علّمها هنا.</p>}
      {isFuture && <p className="muted center">يوم جاي: شوف عليك إيه، وضيف تذكير أو مهمة.</p>}

      {isToday && !isStandalone() && <InstallCard ios={isIOS()} />}

      {isToday && backupDue(settings) && (
        <button className="card card-action backup-nudge" onClick={() => shareBackup().catch(() => {})}>
          <span className="card-icon">
            <Icon name="download" />
          </span>
          <span>
            <strong>اعمل نسخة احتياطية</strong>
            <small>
              {settings.lastBackup ? 'فات أسبوع من آخر نسخة.' : 'لسه ما عملتش ولا نسخة.'} دوس هنا واحفظها في Files — ثانية
              واحدة
            </small>
          </span>
        </button>
      )}

      {!settings.location?.auto && (
        <button className="card card-action" onClick={locate}>
          <span className="card-icon">
            <Icon name="pin" />
          </span>
          <span>
            <strong>حدد مكانك</strong>
            <small>{locMsg || 'المواقيت دلوقتي على القاهرة. دوس هنا عشان تبقى على مكانك بالظبط'}</small>
          </span>
        </button>
      )}

      {next && (
        <p className="card next-up next-up-card">
          <span className="next-dot" />
          اللي جاي: <strong>{next.title}</strong> {formatTime(next.time)}، باقي {formatDuration(minutesBetween(now, next.time))}
        </p>
      )}

      <HadithCard dateK={today} onOpenLibrary={() => onOpenSub('hadith')} />

      <PlanToday today={today} isToday={isToday} onOpenSub={onOpenSub} />

      <DayReminders dateK={today} weekday={day.getDay()} label={dayLabel} onAdd={() => setQuickAdd(true)} />

      <FastCard
        day={day}
        now={now}
        isToday={isToday}
        isFuture={isFuture}
        times={times}
        today={today}
        checkedSet={checkedSet}
        tomorrowK={tomorrowK}
        tomorrowSet={new Set((tomorrowChecks || []).map((c) => c.item))}
      />

      <ol className={`timeline ${isFuture ? 'is-future' : ''}`}>
        {rows.map((r) => {
          if (r.type === 'prayer')
            return (
              <PrayerRow
                key={r.id}
                row={r}
                now={now}
                isCurrent={curPrayer === r.prayer}
                done={checkedSet.has(r.id)}
                state={checked.get(r.id)?.value}
                onState={(v) => toggle(r.id, true, v)}
                onToggle={(d) => toggle(r.id, d, 'ontime')}
              />
            )
          if (r.type === 'wird') {
            const c = checked.get('wird')
            const juz = c ? c.value : settings.wirdNext || 1
            const pos = !c && settings.wirdPos?.juz === juz ? settings.wirdPos : null
            return (
              <CheckRow
                key={r.id}
                row={{
                  ...r,
                  title: `الورد: الجزء ${num(juz)}`,
                  subtitle: c ? 'قريته ✓' : pos ? `قريت ${num(pos.pct || 0)}٪ — كمّل من مكان ما وقفت` : 'دوس عشان تقرا',
                }}
                done={!!c}
                onToggle={(d) => toggleWird(juz, d)}
                onOpen={() => setOverlay({ kind: 'quran', juz })}
                openLabel={pos ? 'كمّل' : 'اقرا'}
              />
            )
          }
          if (r.type === 'work') {
            return (
              <TasksBlock key={r.id} g={g} checkedSet={checkedSet} today={today} total={workTotal} done={workDone} onOpen={onOpenTasks} />
            )
          }
          if (r.type === 'tasbih') {
            const goal = settings.tasbihDailyGoal ?? 100
            return (
              <CheckRow
                key={r.id}
                row={{ ...r, subtitle: tasbihToday >= goal ? `${num(tasbihToday)} تسبيحة ✓` : `${num(tasbihToday)} من ${num(goal)}` }}
                done={checkedSet.has(r.id)}
                onToggle={(d) => toggle(r.id, d)}
                onOpen={() => onOpenSub('tasbih')}
                openLabel="سبّح"
              />
            )
          }
          if (r.type === 'water') {
            const first = r.id === 'water:p0'
            const askFast = first && isToday && !fasting && !checkedSet.has('fast:no') && !isSunnahFastDay(day) && now < times.maghrib
            return (
              <CheckRow
                key={r.id}
                row={r}
                done={checkedSet.has(r.id)}
                onToggle={(d) => toggleWater(r, d)}
                onOpen={askFast ? () => window.confirm('صايم النهارده؟ المية هتتقسم من المغرب للفجر') && setFast(today, true) : undefined}
                openLabel="صايم؟"
              />
            )
          }
          if (r.type === 'gym') {
            const done = checkedSet.has('gym')
            const label = r.routine.exercises.length ? `${num(r.routine.exercises.length)} تمارين + كارديو ${num(r.routine.cardio)} دقيقة` : `مشي ${num(r.routine.walk)} دقيقة`
            return (
              <CheckRow
                key={r.id}
                row={{ ...r, subtitle: r.routine.optional ? `${label}، اختياري` : label }}
                done={done}
                onToggle={(d) => toggle('gym', d, r.routine.id)}
                onOpen={() => setOverlay({ kind: 'gym', routine: r.routine })}
                openLabel="ابدأ"
              />
            )
          }
          if (r.id.startsWith('adhkar:')) {
            const kind = r.id.split(':')[1]
            return (
              <CheckRow
                key={r.id}
                row={r}
                done={checkedSet.has(r.id)}
                onToggle={(d) => toggle(r.id, d)}
                onOpen={() => setOverlay({ kind: 'adhkar', adhkar: kind })}
                openLabel="اقرا"
              />
            )
          }
          if (r.type === 'zein')
            return (
              <ZeinRow
                key={r.id}
                row={r}
                today={today}
                settings={settings}
                done={checkedSet.has('zein')}
                onToggle={(d) => toggle('zein', d)}
              />
            )
          if (r.id === 'hifz')
            return (
              <CheckRow
                key={r.id}
                row={{ ...r, ...hifzRow }}
                done={checkedSet.has(r.id)}
                onToggle={(d) => toggle(r.id, d)}
                onOpen={onOpenHifz}
                openLabel="تقدّمي"
              />
            )
          return <CheckRow key={r.id} row={r} done={checkedSet.has(r.id)} onToggle={(d) => toggle(r.id, d)} />
        })}
      </ol>

      {!isFuture && <button
        className={`card card-action excuse ${excused ? 'is-on' : ''}`}
        onClick={() => toggle('day:excused', !excused)}
        aria-pressed={excused}
      >
        <span className="card-icon">
          <Icon name={excused ? 'check' : 'bed'} />
        </span>
        <span>
          <strong>{excused ? (isToday ? 'النهارده يوم عذر' : 'امبارح كان يوم عذر') : 'يوم عذر؟ (سفر أو تعب)'}</strong>
          <small>
            {excused
              ? 'العادات اللي فاتتك مش هتكسر السلسلة. الصلاة بتفضل زي ما هي. دوس تاني للإلغاء'
              : 'علّمه عشان اللي يفوتك من العادات ما يكسرش السلسلة'}
          </small>
        </span>
      </button>}

      {overlay?.kind === 'quran' && (
        <QuranReader juz={overlay.juz} today={today} settings={settings} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'adhkar' && (
        <AdhkarReader kind={overlay.adhkar} today={today} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'gym' && <Workout routine={overlay.routine} today={today} onClose={() => setOverlay(null)} />}

      {!isPast && !overlay && (
        <button className="fab" onClick={() => setQuickAdd(true)} aria-label="ضيف مهمة أو تذكير">
          <Icon name="plus" size={26} stroke={2.2} />
        </button>
      )}
      {quickAdd && <QuickAddSheet date={today} today={todayKey(realNow)} settings={settings} onClose={() => setQuickAdd(false)} />}
    </>
  )
}

const PRAYER_STATES = [
  ['ontime', 'في وقتها'],
  ['mosque', 'في المسجد'],
  ['late', 'متأخرة'],
  ['qada', 'قضاء'],
]

function PrayerRow({ row, now, isCurrent, done, state, onState, onToggle }) {
  const upcoming = row.time > now
  const st = state === true || !state ? 'ontime' : state
  return (
    <li className={`tl-item tl-prayer ${done ? 'is-done' : ''} ${isCurrent && !done ? 'is-now' : ''}`}>
      <span className="tl-time">{formatTime(row.time)}</span>
      <div className="tl-body">
        <div className="tl-main">
          <span className="tl-icon tl-icon-faith">
            <Icon name="moon" size={18} />
          </span>
          <div className="tl-text">
            <strong>{row.title}</strong>
            {isCurrent && !done && <small className="now-tag">وقتها دلوقتي</small>}
            {!isCurrent && upcoming && <small>لسه</small>}
          </div>
          <CheckButton done={done} onToggle={onToggle} label={`صليت ${row.title}`} />
        </div>
        {done && (
          <div className="state-row" role="radiogroup" aria-label={`صليت ${row.title} إزاي`}>
            {PRAYER_STATES.map(([id, label]) => (
              <button key={id} className={`mini ${st === id ? 'is-on' : ''} mini-${id}`} onClick={() => onState(id)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function CheckRow({ row, done, onToggle, onOpen, openLabel }) {
  const aspect = row.type === 'water' ? 'work' : ITEM_ASPECT(row.id)
  return (
    <li className={`tl-item ${done ? 'is-done' : ''}`}>
      <span className="tl-time">{row.hideTime ? '' : formatTime(row.time)}</span>
      <div className="tl-body">
        <div className="tl-main">
          <span className={`tl-icon tl-icon-${aspect}`}>
            <Icon name={row.icon} size={18} />
          </span>
          {onOpen ? (
            <button className="tl-text link-row tl-open" onClick={onOpen}>
              <strong>{row.title}</strong>
              {row.subtitle && <small>{row.subtitle}</small>}
            </button>
          ) : (
            <div className="tl-text">
              <strong>{row.title}</strong>
              {row.subtitle && <small>{row.subtitle}</small>}
            </div>
          )}
          {onOpen && !done && (
            <button className="open-btn" onClick={onOpen}>
              {openLabel}
            </button>
          )}
          <CheckButton done={done} onToggle={onToggle} label={row.title} />
        </div>
      </div>
    </li>
  )
}

// شريط أيام الشهر: ١، ٢، ٣… لحد آخر الشهر، والنقطة يعني فيه حاجة عليك اليوم ده
const SHORT_DAY = { 6: 'سبت', 0: 'حد', 1: 'اتنين', 2: 'تلات', 3: 'أربع', 4: 'خميس', 5: 'جمعة' }
function DayStrip({ day, base, onPick }) {
  const ref = useRef(null)
  const y = day.getFullYear()
  const m = day.getMonth()
  const count = new Date(y, m + 1, 0).getDate()
  const from = dateKey(new Date(y, m, 1))
  const to = dateKey(new Date(y, m, count))
  const busy = useLiveQuery(async () => {
    const [tasks, appts, posts, rems] = await Promise.all([
      db.tasks.where('date').between(from, to, true, true).toArray(),
      db.appts.where('date').between(from, to, true, true).toArray(),
      db.posts.where('date').between(from, to, true, true).toArray(),
      db.reminders.toArray(),
    ])
    const set = new Set([...tasks.filter((t) => !t.done).map((t) => t.date), ...appts.filter((a) => !a.done).map((a) => a.date), ...posts.map((p) => p.date)])
    for (const r of rems) if (r.active !== false && r.date >= from && r.date <= to) set.add(r.date)
    return { set, weekly: new Set(rems.filter((r) => r.active !== false && !r.date).map((r) => r.weekday)) }
  }, [from, to])

  // نحرّك الشريط بالعرض بس، من غير ما الصفحة نفسها تتحرك لفوق
  const dk = dateKey(day)
  useEffect(() => {
    const box = ref.current
    const el = box?.querySelector('.is-sel')
    if (!el) return
    const a = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    box.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: 'smooth' })
  }, [dk])

  const baseKey = dateKey(base)
  const days = Array.from({ length: count }, (_, i) => new Date(y, m, i + 1))
  return (
    <div className="day-strip" ref={ref}>
      {days.map((d) => {
        const k = dateKey(d)
        const has = busy && (busy.set.has(k) || busy.weekly.has(d.getDay()))
        return (
          <button
            key={k}
            className={`ds-day ${k === dateKey(day) ? 'is-sel' : ''} ${k === baseKey ? 'is-today' : ''} ${k < baseKey ? 'is-past' : ''} ${d.getDay() === 5 ? 'is-fri' : ''}`}
            onClick={() => onPick(Math.round((new Date(y, m, d.getDate(), 12) - new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12)) / 86400000))}
          >
            <small>{SHORT_DAY[d.getDay()]}</small>
            <strong>{num(d.getDate())}</strong>
            <span className={`ds-dot ${has ? 'on' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}

const DAY_LABEL = { 6: 'السبت', 0: 'الحد', 1: 'الاتنين', 2: 'التلات', 3: 'الأربع', 4: 'الخميس', 5: 'الجمعة' }

// يوم جاي: تقرر من دلوقتي هتصوم ولا لأ
function FutureFast({ day, today, checkedSet }) {
  const yes = checkedSet.has('fast:yes')
  const no = checkedSet.has('fast:no')
  if (yes)
    return (
      <section className="card fast-card is-on">
        <div className="row-between">
          <span>
            <strong>ناوي تصوم اليوم ده إن شاء الله</strong>
            <small>هفكّرك بالسحور، والمية هتتقسم من المغرب للفجر.</small>
          </span>
          <button className="link-btn" onClick={() => setFast(today, false)}>
            إلغاء
          </button>
        </div>
      </section>
    )
  if (!isSunnahFastDay(day) || no) return null
  return (
    <section className="card fast-card">
      <strong>{DAY_LABEL[day.getDay()]}: هتصوم؟</strong>
      <div className="row">
        <button className="btn" onClick={() => setFast(today, true)}>
          هصوم إن شاء الله
        </button>
        <button className="btn btn-ghost" onClick={() => setFast(today, false)}>
          مش المرة دي
        </button>
      </div>
    </section>
  )
}

// تذكيرات اليوم: بإشعار في الساعة اللي تحددها، مرة واحدة أو كل أسبوع — وممكن تضيف مهمة لليوم ده
function DayReminders({ dateK, weekday, label, onAdd }) {
  const all = useLiveQuery(() => db.reminders.toArray(), [])
  if (!all) return null
  const list = remindersFor(all, dateK, weekday)

  return (
    <section className="card reminders">
      {list.length > 0 && (
        <ul className="tasks">
          {list.map((r) => (
            <li key={r.id} className="task">
              <Icon name="bell" size={18} />
              <span className="task-title">
                {r.title}
                <small className="muted">
                  {r.at ? formatTime(new Date(`2000-01-01T${r.at}`)) : ''}
                  {r.weekday != null && !r.date ? ` — كل ${DAY_LABEL[r.weekday]}` : ''}
                </small>
              </span>
              <button
                className="icon-btn"
                onClick={() => window.confirm(`تمسح التذكير "${r.title}"${r.date ? '' : ' (كل أسبوع)'}؟`) && db.reminders.delete(r.id)}
                aria-label="امسح التذكير"
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="link-btn add-reminder" onClick={onAdd}>
        <Icon name="plus" size={16} /> ضيف مهمة أو تذكير {label === 'النهارده' ? 'للنهارده' : label === 'بكرة' ? 'لبكرة' : 'لليوم ده'}
      </button>
    </section>
  )
}

// وقت زين: فكرة نشاط مختلفة كل يوم، و"فكرة تانية" لو مش مناسبة
function ZeinRow({ row, today, settings, done, onToggle }) {
  const pick = settings.zeinPick?.date === today ? settings.zeinPick.shift : 0
  const idea = zeinIdea(today, pick)
  const [open, setOpen] = useState(false)
  return (
    <li className={`tl-item ${done ? 'is-done' : ''}`}>
      <span className="tl-time">{formatTime(row.time)}</span>
      <div className="tl-body">
        <div className="tl-main">
          <span className="tl-icon tl-icon-family">
            <Icon name="heart" size={18} />
          </span>
          <button className="tl-text link-row tl-open" onClick={() => setOpen(!open)}>
            <strong>وقت زين</strong>
            <small>النهارده: {idea.title}</small>
          </button>
          <CheckButton done={done} onToggle={onToggle} label="وقت زين" />
        </div>
        {open && (
          <div className="zein-idea">
            <p>{idea.how}</p>
            <p className="muted">٢٠–٣٠ دقيقة، والموبايل بعيد.</p>
            <button className="link-btn" onClick={() => setSetting('zeinPick', { date: today, shift: pick + 1 })}>
              فكرة تانية ←
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

// الصيام: الاتنين والخميس بيسألك، ولو قررت تصوم المية والوجبات بتتغير
async function setFast(date, yes) {
  await setCheck(date, yes ? 'fast:yes' : 'fast:no', true)
  await setCheck(date, yes ? 'fast:no' : 'fast:yes', false)
}

function FastCard({ day, now, isToday, isFuture, times, today, checkedSet, tomorrowK, tomorrowSet }) {
  if (isFuture) return <FutureFast day={day} today={today} checkedSet={checkedSet} />
  const fasting = checkedSet.has('fast:yes')
  const decidedToday = fasting || checkedSet.has('fast:no')
  const tomorrow = addDays(day, 1)
  const askToday = isToday && isSunnahFastDay(day) && !decidedToday && now < times.maghrib
  const askTomorrow = isToday && isSunnahFastDay(tomorrow) && !tomorrowSet.has('fast:yes') && !tomorrowSet.has('fast:no') && now >= times.asr
  const tomorrowYes = isToday && tomorrowSet.has('fast:yes')
  const dayName = (d) => (d.getDay() === 1 ? 'الاتنين' : d.getDay() === 4 ? 'الخميس' : '')

  if (fasting)
    return (
      <section className="card fast-card is-on">
        <div className="row-between">
          <span>
            <strong>صايم النهارده 🤍</strong>
            <small>
              {now < times.maghrib
                ? `الفطار ${formatTime(times.maghrib)}، باقي ${formatDuration(minutesBetween(now, times.maghrib))}`
                : 'ذهب الظمأ وابتلّت العروق وثبت الأجر إن شاء الله — تقبّل الله'}
            </small>
          </span>
          {now < times.maghrib && (
            <button className="link-btn" onClick={() => window.confirm('فطرت النهارده؟') && setFast(today, false)}>
              فطرت
            </button>
          )}
        </div>
        <p className="muted">المية اتظبطت على الصيام: من المغرب للفجر.</p>
      </section>
    )
  if (askToday)
    return (
      <section className="card fast-card">
        <strong>النهارده {dayName(day)}: صايم؟</strong>
        <small className="muted">لو صايم، المية هتتقسم من المغرب للفجر.</small>
        <div className="row">
          <button className="btn" onClick={() => setFast(today, true)}>
            أيوه صايم
          </button>
          <button className="btn btn-ghost" onClick={() => setFast(today, false)}>
            مش النهارده
          </button>
        </div>
      </section>
    )
  if (askTomorrow)
    return (
      <section className="card fast-card">
        <strong>بكرة {dayName(tomorrow)}: هتصوم؟</strong>
        <small className="muted">لو آه، هفكّرك بالسحور وأقسّم المية من المغرب للفجر.</small>
        <div className="row">
          <button className="btn" onClick={() => setFast(tomorrowK, true)}>
            هصوم إن شاء الله
          </button>
          <button className="btn btn-ghost" onClick={() => setFast(tomorrowK, false)}>
            مش المرة دي
          </button>
        </div>
      </section>
    )
  if (tomorrowYes)
    return (
      <section className="card fast-card is-on">
        <div className="row-between">
          <span>
            <strong>نويت تصوم بكرة إن شاء الله</strong>
            <small>هفكّرك بالسحور قبل الفجر بساعة. اشرب مية كويس الليلة.</small>
          </span>
          <button className="link-btn" onClick={() => setFast(tomorrowK, false)}>
            إلغاء
          </button>
        </div>
      </section>
    )
  return null
}

function TasksBlock({ g, checkedSet, today, total, done, onOpen }) {
  // أهم ٤ حاجات لسه ما خلصتش: المتأخرة والمهمة الأول، وبعدين الثابتة
  const pending = [
    ...g.today.filter((t) => !t.done),
    ...g.daily.filter((t) => !checkedSet.has(`task:${t.id}`)),
  ].slice(0, 12)
  const more = total - done - pending.length

  return (
    <li className="tl-item tl-work">
      <span className="tl-time" />
      <div className="tl-body card-inner">
        <button className="row-between link-row" onClick={onOpen}>
          <div className="tl-main">
            <span className="tl-icon tl-icon-work">
              <Icon name="briefcase" size={18} />
            </span>
            <div className="tl-text">
              <strong>المهام</strong>
              <small>{total ? `${num(done)} من ${num(total)}` : 'لسه مفيش مهام'}</small>
            </div>
          </div>
          <span className="link-btn">
            كل المهام <Icon name="chevronLeft" size={16} />
          </span>
        </button>
        {pending.length > 0 ? (
          <ul className="tasks">
            {pending.map((t) => (
              <TaskItem key={`${t.kind}${t.id}`} t={t} done={false} today={today} />
            ))}
            {more > 0 && <li className="tasks-label">و{num(more)} كمان…</li>}
          </ul>
        ) : (
          total > 0 && <p className="muted">خلّصت كل مهام النهارده ✓</p>
        )}
      </div>
    </li>
  )
}

function InstallCard({ ios }) {
  return (
    <section className="card install">
      <h2>ثبّت التطبيق على موبايلك</h2>
      {ios ? (
        <ol className="steps">
          <li>
            دوس زرار المشاركة <Icon name="share" size={18} /> تحت في Safari
          </li>
          <li>
            اختار <strong>إضافة إلى الشاشة الرئيسية</strong> <Icon name="plusSquare" size={18} />
          </li>
          <li>
            سمّيه <strong>مصطفى لايف</strong> ودوس <strong>إضافة</strong>
          </li>
          <li>افتحه من الأيقونة الجديدة، مش من Safari</li>
        </ol>
      ) : (
        <p className="muted">افتح قائمة المتصفح واختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".</p>
      )}
    </section>
  )
}
