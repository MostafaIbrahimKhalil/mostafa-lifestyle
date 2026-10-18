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

export default function Today({ settings, aspects, onOpenTasks }) {
  const now = useNow()
  const day = logicalDate(now)
  const today = todayKey(now)
  const [tasbihFor, setTasbihFor] = useState(null)
  const [locMsg, setLocMsg] = useState(null)

  const checks = useLiveQuery(() => db.checks.where('date').equals(today).toArray(), [today])
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])

  const { rows, times } = buildDay(day, settings)
  const checked = useMemo(() => new Map((checks || []).map((c) => [c.item, c])), [checks])
  const checkedSet = useMemo(() => new Set(checked.keys()), [checked])
  const g = useMemo(() => groupTasks(allTasks || [], today), [allTasks, today])

  const workTotal = g.daily.length + g.today.length
  const workDone = g.daily.filter((t) => checkedSet.has(`task:${t.id}`)).length + g.today.filter((t) => t.done).length
  const progress = progressFor(checkedSet, settings, workTotal, workDone)
  const curPrayer = currentPrayer(times, now)

  // أول بند لسه ما اتعلّمش ووقته جاي
  const next = rows.find((r) => !r.hideTime && r.time > now && !checkedSet.has(r.id))

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
          <span className="dot" aria-hidden="true">·</span>
          <span>{formatHijri(day)}</span>
        </p>
      </header>

      {!isStandalone() && <InstallCard ios={isIOS()} />}

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
            centerLabel="النهارده"
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
            اللي جاي: <strong>{next.title}</strong> {formatTime(next.time)} · باقي{' '}
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
                tasbihDone={checkedSet.has(`tasbih:${r.prayer}`)}
                onToggle={(d) => toggle(r.id, d)}
                onTasbih={() => setTasbihFor(r)}
                onUndoTasbih={() => toggle(`tasbih:${r.prayer}`, false)}
              />
            )
          if (r.type === 'wird') {
            const c = checked.get('wird')
            const juz = c ? c.value : settings.wirdNext || 1
            return (
              <CheckRow
                key={r.id}
                row={{ ...r, title: `الورد: الجزء ${num(juz)}`, subtitle: 'جزء في اليوم' }}
                done={!!c}
                onToggle={(d) => toggleWird(juz, d)}
              />
            )
          }
          if (r.type === 'work')
            return (
              <TasksBlock key={r.id} g={g} checkedSet={checkedSet} today={today} total={workTotal} done={workDone} onOpen={onOpenTasks} />
            )
          return <CheckRow key={r.id} row={r} done={checkedSet.has(r.id)} onToggle={(d) => toggle(r.id, d)} />
        })}
      </ol>

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

function PrayerRow({ row, now, isCurrent, done, tasbihDone, onToggle, onTasbih, onUndoTasbih }) {
  const upcoming = row.time > now
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

function CheckRow({ row, done, onToggle }) {
  const aspect = row.id.startsWith('teeth') ? 'health' : 'faith'
  return (
    <li className={`tl-item ${done ? 'is-done' : ''}`}>
      <span className="tl-time">{row.hideTime ? '' : formatTime(row.time)}</span>
      <div className="tl-body">
        <div className="tl-main">
          <span className={`tl-icon tl-icon-${aspect}`}>
            <Icon name={row.icon} size={18} />
          </span>
          <div className="tl-text">
            <strong>{row.title}</strong>
            {row.subtitle && <small>{row.subtitle}</small>}
          </div>
          <CheckButton done={done} onToggle={onToggle} label={row.title} />
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
