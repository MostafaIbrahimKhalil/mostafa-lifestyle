// أدوات التاريخ — كل التواريخ بتتحسب بتوقيت الموبايل نفسه

export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatGregorian(d = new Date()) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function formatHijri(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'ليلة سعيدة'
  if (h < 12) return 'صباح الخير'
  if (h < 17) return 'نهارك سعيد'
  return 'مساء الخير'
}

// أسبوع مصطفى بيبدأ السبت وبيخلص الجمعة
export const WEEK_START = 6 // 0 = الأحد ... 6 = السبت

export function startOfWeek(d = new Date()) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (copy.getDay() - WEEK_START + 7) % 7
  copy.setDate(copy.getDate() - diff)
  return copy
}

// اليوم بيتقفل الساعة ٣ الفجر مش ١٢ بالليل — عشان أذكار النوم وأسنان الليل بعد ١٢ تتحسب على نفس اليوم
export const DAY_CUTOFF_HOUR = 3

export function logicalDate(now = new Date()) {
  const d = new Date(now)
  if (d.getHours() < DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function todayKey(now = new Date()) {
  return dateKey(logicalDate(now))
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d, n) {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function formatTime(d) {
  return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(d)
}

export function formatMonth(year, monthIndex) {
  return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1))
}

export function formatShortDate(d) {
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long' }).format(d)
}

export function num(n) {
  return Number(n).toLocaleString('ar-EG')
}

// "HH:MM" لوقت في يوم معيّن. لو الساعة قبل ٣ الفجر يبقى تبع اليوم اللي بعده (بعد نص الليل)
export function timeOnDay(day, hm) {
  const [h, m] = hm.split(':').map(Number)
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
  if (h < DAY_CUTOFF_HOUR) d.setDate(d.getDate() + 1)
  return d
}

export function minutesBetween(a, b) {
  return Math.round((b - a) / 60000)
}

export function formatDuration(mins) {
  if (mins < 60) return `${num(mins)} دقيقة`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${num(h)} س و${num(m)} د` : `${num(h)} ساعة`
}
