// إضافة سريعة: اكتب اللي عايز تعمله، واختار إمتى. بيفهم "بكرة الساعة ٥" لوحده
import { useState } from 'react'
import Icon from './Icon.jsx'
import { addDays, dateKey, formatShortDate, formatTime, fromKey } from '../lib/dates.js'
import { PRIORITY, TASK_CATS, addTask } from '../lib/tasks.js'
import { addReminder } from '../lib/reminders.js'
import { parseWhen } from '../lib/when.js'
import { sync } from '../lib/push.js'
import { db } from '../db.js'

const DAY = ['الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت']

export function dayName(k, today) {
  const tomorrow = dateKey(addDays(fromKey(today), 1))
  if (k === today) return 'النهارده'
  if (k === tomorrow) return 'بكرة'
  const d = fromKey(k)
  return `${DAY[d.getDay()]} ${formatShortDate(d)}`
}

const hm = (at) => formatTime(new Date(`2000-01-01T${at}`))

export default function QuickAddSheet({ date, today, settings, onClose, onAdded, defaultCategory = 'personal' }) {
  const tomorrow = dateKey(addDays(fromKey(today), 1))
  const [text, setText] = useState('')
  const [day, setDay] = useState(date < today ? today : date)
  const [picked, setPicked] = useState({}) // اللي إنت اخترته بإيدك ما يتغيرش من الكتابة
  const [kind, setKind] = useState('task') // task | reminder
  const [at, setAt] = useState(null)
  const [weekly, setWeekly] = useState(false)
  const [priority, setPriority] = useState(2)
  const [category, setCategory] = useState(defaultCategory)
  const [daily, setDaily] = useState(false)
  const [saved, setSaved] = useState(null)

  const parsed = text.trim() ? parseWhen(text, today) : null

  function onText(v) {
    setText(v)
    setSaved(null)
    const p = v.trim() ? parseWhen(v, today) : null
    if (!p) return
    if (p.date && !picked.day) setDay(p.date)
    if (p.at && !picked.at) setAt(p.at)
    if (!picked.kind) setKind(p.remind ? 'reminder' : 'task')
  }
  const pick = (k, fn) => (v) => {
    setPicked((x) => ({ ...x, [k]: true }))
    fn(v)
  }

  async function save(e) {
    e.preventDefault()
    const title = (parsed?.title || text).trim()
    if (!title) return
    if (kind === 'reminder') {
      const time = at || '09:00'
      await addReminder({ title, at: time, date: day, weekly, weekday: fromKey(day).getDay() })
    } else if (daily) {
      const id = await addTask({ title, kind: 'daily', category, priority, date: day })
      if (day > today) await db.tasks.update(id, { startDate: day })
    } else {
      await addTask({ title, kind: 'once', category, priority, date: day, at })
    }
    sync(settings).catch(() => {})
    setSaved(daily && kind === 'task' ? `مهمة كل يوم من ${dayName(day, today)} ✓` : `${kind === 'reminder' ? 'تذكير' : 'مهمة'} ${weekly && kind === 'reminder' ? `كل ${DAY[fromKey(day).getDay()]}` : dayName(day, today)}${at || kind === 'reminder' ? ` ${hm(at || '09:00')}` : ''} ✓`)
    onAdded?.(day)
    setText('')
    setPicked({})
    setAt(null)
    setWeekly(false)
    setDaily(false)
    setKind('task')
    setPriority(2)
  }

  const isOther = day !== today && day !== tomorrow

  return (
    <div className="sheet-backdrop sheet-backdrop-top" onClick={onClose}>
      <form className="sheet sheet-top quick-sheet" role="dialog" aria-label="ضيف حاجة" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="row-between">
          <strong>ضيف حاجة</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="اقفل">
            <Icon name="close" size={20} />
          </button>
        </div>

        <input
          className="input quick-input"
          placeholder="مثلًا: بكرة الساعة ٥ اتصل بالمكتبة"
          value={text}
          onChange={(e) => onText(e.target.value)}
          maxLength={90}
          autoFocus
        />
        {saved && <p className="quick-saved">اتضافت: {saved}</p>}

        <div className="quick-row">
          <span className="quick-label">إمتى</span>
          <div className="chip-wrap">
            <button type="button" className={`chip ${day === today ? 'chip-on' : ''}`} onClick={() => pick('day', setDay)(today)}>
              النهارده
            </button>
            <button type="button" className={`chip ${day === tomorrow ? 'chip-on' : ''}`} onClick={() => pick('day', setDay)(tomorrow)}>
              بكرة
            </button>
            <label className={`chip chip-date ${isOther ? 'chip-on' : ''}`}>
              <Icon name="calendar" size={15} />
              {isOther ? dayName(day, today) : 'يوم تاني'}
              <input type="date" min={today} value={day} onChange={(e) => e.target.value && pick('day', setDay)(e.target.value)} />
            </label>
            {kind === 'task' && (
              <button type="button" className={`chip ${daily ? 'chip-on' : ''}`} onClick={() => setDaily(!daily)}>
                كل يوم
              </button>
            )}
          </div>
        </div>

        <div className="quick-row">
          <span className="quick-label">النوع</span>
          <div className="seg seg-small">
            <button type="button" className={kind === 'task' ? 'is-on' : ''} onClick={() => pick('kind', setKind)('task')}>
              مهمة
            </button>
            <button type="button" className={kind === 'reminder' ? 'is-on' : ''} onClick={() => pick('kind', setKind)('reminder')}>
              <Icon name="bell" size={15} /> تذكير بإشعار
            </button>
          </div>
        </div>

        <div className="quick-row">
          <span className="quick-label">الساعة</span>
          <div className="chip-wrap">
            {kind === 'task' && (
              <button type="button" className={`chip ${!at ? 'chip-on' : ''}`} onClick={() => pick('at', setAt)(null)}>
                أي وقت
              </button>
            )}
            <label className={`chip chip-date ${at ? 'chip-on' : ''}`}>
              {at ? hm(at) : kind === 'reminder' ? hm('09:00') : 'حدد ساعة'}
              <input type="time" value={at || '09:00'} onChange={(e) => e.target.value && pick('at', setAt)(e.target.value)} />
            </label>
            {kind === 'reminder' && (
              <button type="button" className={`chip ${weekly ? 'chip-on' : ''}`} onClick={() => setWeekly(!weekly)}>
                كل {DAY[fromKey(day).getDay()]}
              </button>
            )}
          </div>
        </div>

        {kind === 'task' && (
          <>
            <div className="quick-row">
              <span className="quick-label">الأهمية</span>
              <div className="chip-wrap">
                {[1, 2, 3].map((p) => (
                  <button key={p} type="button" className={`chip ${priority === p ? 'chip-on' : ''}`} onClick={() => setPriority(p)}>
                    <span className={`prio ${PRIORITY[p].cls}`} /> {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="quick-row">
              <span className="quick-label">تبع</span>
              <div className="chip-wrap">
                {Object.entries(TASK_CATS).map(([id, c]) => (
                  <button key={id} type="button" className={`chip ${category === id ? 'chip-on' : ''}`} onClick={() => setCategory(id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="btn btn-wide" type="submit" disabled={!text.trim()}>
          <Icon name="plus" size={18} />
          {text.trim() && daily && kind === 'task'
            ? `ضيف مهمة كل يوم من ${dayName(day, today)}`
            : text.trim()
            ? `ضيف ${kind === 'reminder' ? 'تذكير' : 'مهمة'} ${weekly && kind === 'reminder' ? `كل ${DAY[fromKey(day).getDay()]}` : dayName(day, today)}${at || kind === 'reminder' ? ` ${hm(at || '09:00')}` : ''}`
            : 'اكتب الأول'}
        </button>
        {kind === 'task' && <p className="muted small">المهمة لو ما خلصتش بتتنقل لليوم اللي بعده لوحدها. {at ? `وهيجيلك إشعار قبلها بربع ساعة.` : ''}</p>}
        {parsed && (parsed.date || parsed.at) && <p className="muted small">العنوان: «{parsed.title}»</p>}
      </form>
    </div>
  )
}
