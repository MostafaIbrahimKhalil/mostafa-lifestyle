import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import BalanceRing from '../components/BalanceRing.jsx'
import Icon from '../components/Icon.jsx'
import TasbihSheet from '../components/TasbihSheet.jsx'
import { db, setCheck, setSetting } from '../db.js'
import { useNow } from '../hooks.js'
import { buildDay, currentPrayer, progressFor } from '../lib/day.js'
import { groupTasks } from '../lib/tasks.js'
import { CheckButton, TaskItem } from '../components/TaskParts.jsx'
import {
  addDays,
  dateKey,
  formatDuration,
  formatGregorian,
  formatHijri,
  formatTime,
  greeting,
  logicalDate,
  minutesBetween,
  num,
  todayKey,
} from '../lib/dates.js'
import { isIOS, isStandalone } from '../lib/device.js'
import { getDeviceLocation } from '../lib/prayer.js'
import { MEALS, WATER_TARGET } from '../lib/day.js'
import QuranReader from './QuranReader.jsx'
import AdhkarReader from './AdhkarReader.jsx'
import Workout from './Workout.jsx'
import { backupDue, shareBackup } from '../lib/backup.js'

export default function Today({ settings, aspects, onOpenTasks, onOpenHifz }) {
  const realNow = useNow()
  const [offset, setOffset] = useState(0) // ٠ = النهارده، -١ = امبارح (لو نسيت تعلّم)
  const isToday = offset === 0
  const day = addDays(logicalDate(realNow), offset)
  const today = isToday ? todayKey(realNow) : dateKey(day)
  // لما بنبص على امبارح بنعتبر اليوم كله خلص
  const now = isToday ? realNow : addDays(day, 1)
  const [tasbihFor, setTasbihFor] = useState(null)
  const [locMsg, setLocMsg] = useState(null)
  const [overlay, setOverlay] = useState(null) // { kind: 'quran'|'adhkar'|'gym', ... }

  const checks = useLiveQuery(() => db.checks.where('date').equals(today).toArray(), [today])
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])

  const { rows, times } = buildDay(day, settings)
  const checked = useMemo(() => new Map((checks || []).map((c) => [c.item, c])), [checks])
  const checkedSet = useMemo(() => new Set(checked.keys()), [checked])
  const g = useMemo(() => groupTasks(allTasks || [], today), [allTasks, today])

  const workTotal = g.daily.length + g.today.length
  const workDone = g.daily.filter((t) => checkedSet.has(`task:${t.id}`)).length + g.today.filter((t) => t.done).length
  const progress = progressFor(checkedSet, settings, workTotal, workDone, day)
  const curPrayer = isToday ? currentPrayer(times, now) : null
  const excused = checkedSet.has('day:excused')

  // أول بند لسه ما اتعلّمش ووقته جاي
  const next = isToday && rows.find((r) => !r.hideTime && r.time > now && !checkedSet.has(r.id))

  const toggle = (item, done, value) => setCheck(today, item, done, value)

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

      <div className="seg day-switch" role="radiogroup" aria-label="اليوم">
        <button className={!isToday ? 'is-on' : ''} onClick={() => setOffset(-1)}>
          امبارح
        </button>
        <button className={isToday ? 'is-on' : ''} onClick={() => setOffset(0)}>
          النهارده
        </button>
      </div>

      {!isToday && <p className="muted center">بتعلّم على يوم امبارح — لو نسيت حاجة علّمها هنا.</p>}

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

      <section className="card balance">
        <div className="balance-row">
          <BalanceRing
            aspects={aspects}
            progress={progress.aspects}
            centerValue={`${num(Math.round(progress.overall * 100))}٪`}
            centerLabel={isToday ? 'النهارده' : 'امبارح'}
          />
          <ul className="legend legend-col">
            {aspects.map((a) => (
              <li key={a.id} className={a.soon ? 'is-soon' : ''}>
                <span className="swatch" style={{ background: a.color }} />
                <span>{a.name}</span>
                <span className="legend-val">
                  {a.soon ? 'قريبًا' : `${num(Math.round((progress.aspects[a.id] || 0) * 100))}٪`}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {next && (
          <p className="next-up">
            <span className="next-dot" />
            اللي جاي: <strong>{next.title}</strong> {formatTime(next.time)}، باقي{' '}
            {formatDuration(minutesBetween(now, next.time))}
          </p>
        )}
      </section>

      <ol className="timeline">
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
                tasbihDone={checkedSet.has(`tasbih:${r.prayer}`)}
                onToggle={(d) => toggle(r.id, d, 'ontime')}
                onTasbih={() => setTasbihFor(r)}
                onUndoTasbih={() => toggle(`tasbih:${r.prayer}`, false)}
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
                  subtitle: c ? 'قريته ✓' : pos ? 'كمّل من مكان ما وقفت' : 'دوس عشان تقرا',
                }}
                done={!!c}
                onToggle={(d) => toggleWird(juz, d)}
                onOpen={() => setOverlay({ kind: 'quran', juz })}
                openLabel={pos ? 'كمّل' : 'اقرا'}
              />
            )
          }
          if (r.type === 'work') {
            if (!isToday) return null
            return (
              <TasksBlock key={r.id} g={g} checkedSet={checkedSet} today={today} total={workTotal} done={workDone} onOpen={onOpenTasks} />
            )
          }
          if (r.type === 'food') return <FoodBlock key={r.id} checkedSet={checkedSet} checked={checked} today={today} />
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
          if (r.id === 'hifz')
            return (
              <CheckRow
                key={r.id}
                row={r}
                done={checkedSet.has(r.id)}
                onToggle={(d) => toggle(r.id, d)}
                onOpen={onOpenHifz}
                openLabel="تقدّمي"
              />
            )
          return <CheckRow key={r.id} row={r} done={checkedSet.has(r.id)} onToggle={(d) => toggle(r.id, d)} />
        })}
      </ol>

      <button
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
      </button>

      {overlay?.kind === 'quran' && (
        <QuranReader juz={overlay.juz} today={today} settings={settings} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'adhkar' && (
        <AdhkarReader kind={overlay.adhkar} today={today} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'gym' && <Workout routine={overlay.routine} today={today} onClose={() => setOverlay(null)} />}

      {tasbihFor && (
        <TasbihSheet
          title={`تسبيح بعد ${tasbihFor.title}`}
          onClose={() => setTasbihFor(null)}
          onDone={() => {
            toggle(`tasbih:${tasbihFor.prayer}`, true)
            setTasbihFor(null)
          }}
        />
      )}
    </>
  )
}

const PRAYER_STATES = [
  ['ontime', 'في وقتها'],
  ['mosque', 'في المسجد'],
  ['late', 'متأخرة'],
  ['qada', 'قضاء'],
]

function PrayerRow({ row, now, isCurrent, done, state, onState, tasbihDone, onToggle, onTasbih, onUndoTasbih }) {
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
        {(done || !upcoming) && (
          <button
            className={`chip ${tasbihDone ? 'chip-done' : ''}`}
            onClick={tasbihDone ? onUndoTasbih : onTasbih}
          >
            <Icon name={tasbihDone ? 'check' : 'beads'} size={15} />
            {tasbihDone ? 'سبّحت بعدها' : 'التسبيح بعد الصلاة'}
          </button>
        )}
      </div>
    </li>
  )
}

function CheckRow({ row, done, onToggle, onOpen, openLabel }) {
  const aspect = row.id.startsWith('teeth') || row.id === 'gym' ? 'health' : 'faith'
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

function FoodBlock({ checkedSet, checked, today }) {
  const water = checked.get('water:count')?.value || 0

  async function addWater(delta) {
    const next = Math.max(0, Math.min(20, water + delta))
    await setCheck(today, 'water:count', next > 0, next)
    await setCheck(today, 'water', next >= WATER_TARGET, next)
  }

  return (
    <li className="tl-item tl-work">
      <span className="tl-time" />
      <div className="tl-body">
        <div className="tl-main">
          <span className="tl-icon tl-icon-health">
            <Icon name="plate" size={18} />
          </span>
          <div className="tl-text">
            <strong>الأكل والمية</strong>
            <small>نص الطبق خضار، ربعه بروتين، ربعه نشويات</small>
          </div>
        </div>
        <ul className="tasks">
          {MEALS.map((m) => (
            <li key={m.id} className={`task ${checkedSet.has(m.id) ? 'is-done' : ''}`}>
              <span className="task-title">
                {m.name}
                <small className="muted">على الطبق المظبوط وفيه بروتين</small>
              </span>
              <CheckButton done={checkedSet.has(m.id)} onToggle={(d) => setCheck(today, m.id, d)} label={m.name} />
            </li>
          ))}
          <li className={`task ${checkedSet.has('clean') ? 'is-done' : ''}`}>
            <span className="task-title">
              من غير حاجات تزوّد
              <small className="muted">ساقع، عصير، حلويات، مقليات، أكل بالليل</small>
            </span>
            <CheckButton done={checkedSet.has('clean')} onToggle={(d) => setCheck(today, 'clean', d)} label="من غير حاجات تزوّد" />
          </li>
        </ul>
        <div className="water">
          <div className="row-between">
            <span>
              المية: <strong>{num(water)}</strong> من {num(WATER_TARGET)} كوباية
            </span>
            <small className="muted">{num(((water * 250) / 1000).toFixed(2).replace(/\.?0+$/, ''))} لتر</small>
          </div>
          <div className="water-cups" aria-hidden="true">
            {Array.from({ length: WATER_TARGET }, (_, i) => (
              <span key={i} className={`cup ${i < water ? 'on' : ''}`} />
            ))}
          </div>
          <div className="row">
            <button className="btn" onClick={() => addWater(1)}>
              + كوباية
            </button>
            {water > 0 && (
              <button className="btn btn-ghost" onClick={() => addWater(-1)}>
                −
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function TasksBlock({ g, checkedSet, today, total, done, onOpen }) {
  // أهم ٤ حاجات لسه ما خلصتش: المتأخرة والمهمة الأول، وبعدين الثابتة
  const pending = [
    ...g.today.filter((t) => !t.done),
    ...g.daily.filter((t) => !checkedSet.has(`task:${t.id}`)),
  ].slice(0, 4)
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
