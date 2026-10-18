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
