// تذكيرات بإشعار في يوم وساعة معيّنة — مرة واحدة أو كل أسبوع
import { db, getSetting, setSetting } from '../db.js'
import { DEFAULT_GYM_DAYS } from './workout.js'

export function remindersFor(all, dateKeyStr, weekday) {
  return all
    .filter((r) => r.active !== false && (r.date === dateKeyStr || (r.weekday === weekday && !r.date)))
    .sort((a, b) => (a.at || '').localeCompare(b.at || ''))
}

export async function addReminder({ title, at, date, weekly, weekday }) {
  return db.reminders.add(weekly ? { title, at, weekday, active: true } : { title, at, date, active: true })
}

// الجيم بقى كل يوم: لو كان عندك جدول متعدّل، الأيام الفاضية بتبقى مشي
export async function gymEveryDay() {
  if (await getSetting('gymEveryDay', false)) return
  const days = await getSetting('gymDays', null)
  if (days) {
    const next = { ...days }
    for (const d of Object.keys(DEFAULT_GYM_DAYS)) if (!next[d]) next[d] = 'walk'
    await setSetting('gymDays', next)
  }
  await setSetting('gymEveryDay', true)
}
