// تقسيم المية على اليوم، ويوم الصيام بيتقسم من المغرب للفجر
import { addDays, dateKey, timeOnDay } from './dates.js'
import { DEFAULT_SLEEP } from './day.js'
import { prayerTimesFor } from './prayer.js'

const MIN = 60 * 1000
export const FAST_DAYS = [1, 4] // الاتنين والخميس
export const FAST_START = '2026-10-19' // من إمتى العادة بتتحسب

export const isSunnahFastDay = (day) => FAST_DAYS.includes(day.getDay())

// الوجبات بتتغير أساميها يوم الصيام
export function mealNames(fasting) {
  return fasting
    ? { 'meal:1': 'السحور', 'meal:2': 'الفطار (المغرب)', 'meal:3': 'العشا الخفيف' }
    : { 'meal:1': 'الفطار', 'meal:2': 'الغدا', 'meal:3': 'العشا' }
}

// الكوبايات بمواعيدها. sum = المفروض تكون شربت كام لحد الميعاد ده
export function waterPlan(day, settings, fasting = false) {
  const t = prayerTimesFor(day, settings.location || undefined)
  let sleep = timeOnDay(day, settings.sleepTime || DEFAULT_SLEEP)
  if (sleep < t.isha) sleep = new Date(sleep.getTime() + 24 * 60 * MIN) // النوم بعد نص الليل
  const at = (d, mins = 0) => new Date(d.getTime() + mins * MIN)
  const parts = fasting
    ? [
        { at: at(t.fajr, -50), cups: 3, label: 'مع السحور' },
        { at: at(t.fajr, -12), cups: 1, label: 'قبل الفجر' },
        { at: t.maghrib, cups: 2, label: 'على الفطار، بالراحة' },
        { at: at(t.maghrib, 45), cups: 1, label: 'بعد صلاة المغرب' },
        { at: at(t.isha, 15), cups: 2, label: 'بعد العشا' },
        { at: new Date((t.isha.getTime() + sleep.getTime()) / 2), cups: 2, label: 'بالليل' },
        { at: at(sleep, -30), cups: 1, label: 'قبل النوم' },
      ]
    : [
        { at: at(t.fajr, 10), cups: 1, label: 'بعد الفجر' },
        { at: timeOnDay(day, '09:00'), cups: 2, label: 'أول الشغل' },
        { at: at(t.dhuhr, -60), cups: 1, label: 'قبل الظهر' },
        { at: at(t.dhuhr, 20), cups: 2, label: 'بعد الظهر' },
        { at: at(t.asr, 20), cups: 2, label: 'بعد العصر' },
        { at: at(t.maghrib, 10), cups: 2, label: 'المغرب' },
        { at: at(t.isha, 30), cups: 1, label: 'بعد العشا' },
        { at: at(sleep, -60), cups: 1, label: 'قبل النوم بساعة' },
      ]
  parts.sort((a, b) => a.at - b.at)
  let sum = 0
  for (const p of parts) p.sum = sum += p.cups // المجموع = WATER_TARGET
  return parts
}

// إنت فين من التقسيمة دلوقتي
export function waterStatus(plan, count, now) {
  const due = plan.filter((p) => p.at <= now)
  const shouldHave = due.length ? due[due.length - 1].sum : 0
  const next = plan.find((p) => p.sum > count && p.at > now) || plan.find((p) => p.sum > count)
  return { behind: Math.max(0, shouldHave - count), next }
}

export const tomorrowKey = (day) => dateKey(addDays(day, 1))
