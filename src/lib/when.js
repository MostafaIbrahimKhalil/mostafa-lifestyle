// "بكرة الساعة ٥ العصر اتصل بالمكتبة" ← { date: بكرة، at: '17:00'، title: 'اتصل بالمكتبة' }
import { addDays, dateKey, fromKey } from './dates.js'

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[،]/g, ',')

const WEEKDAYS = [
  [0, ['الحد', 'الأحد', 'الاحد', 'حد']],
  [1, ['الاتنين', 'الإثنين', 'الاثنين', 'اتنين']],
  [2, ['التلات', 'الثلاثاء', 'التلاتاء', 'تلات']],
  [3, ['الأربع', 'الاربع', 'الأربعاء', 'الاربعاء']],
  [4, ['الخميس', 'خميس']],
  [5, ['الجمعة', 'الجمعه', 'جمعة']],
  [6, ['السبت', 'سبت']],
]

const MONTHS = [
  ['يناير'],
  ['فبراير'],
  ['مارس'],
  ['أبريل', 'ابريل'],
  ['مايو'],
  ['يونيو'],
  ['يوليو'],
  ['أغسطس', 'اغسطس'],
  ['سبتمبر'],
  ['أكتوبر', 'اكتوبر'],
  ['نوفمبر'],
  ['ديسمبر'],
]

const NUM_WORDS = {
  واحدة: 1, واحد: 1, اتنين: 2, تلاتة: 3, تلاته: 3, اربعة: 4, أربعة: 4, اربعه: 4, خمسة: 5, خمسه: 5,
  ستة: 6, سته: 6, سبعة: 7, سبعه: 7, تمانية: 8, تمانيه: 8, تسعة: 9, تسعه: 9, عشرة: 10, عشره: 10,
  حداشر: 11, اتناشر: 12,
}

const PM_WORDS = /(العصر|المغرب|بالليل|باليل|الليل|مساء|مساءً|بعد الضهر|بعد الظهر|م\b)/
const AM_WORDS = /(الصبح|الصباح|صباحا|صباحًا|ص\b|الفجر)/
const NOON_WORDS = /(الضهر|الظهر)/

function nextWeekday(today, wd) {
  const t = fromKey(today)
  const diff = (wd - t.getDay() + 7) % 7
  return dateKey(addDays(t, diff))
}

/**
 * بيطلع اليوم والساعة من الجملة، والباقي هو العنوان.
 * today: مفتاح النهارده. بيرجع { title, date|null, at|null, remind }
 */
export function parseWhen(input, today) {
  let s = ` ${toLatin(input)} `
  let date = null
  let at = null
  const cut = (re) => {
    s = s.replace(re, ' ')
  }

  const remind = /(فكرني|فكّرني|ذكرني|ذكّرني|نبهني|نبّهني)/.test(s)
  cut(/\s(فكرني|فكّرني|ذكرني|ذكّرني|نبهني|نبّهني)( ب| إن| ان)?\s/)

  // اليوم
  if (/\sبعد\s?بكر[ةها]\s/.test(s)) {
    date = dateKey(addDays(fromKey(today), 2))
    cut(/\sبعد\s?بكر[ةها]\s/)
  } else if (/\sبكر[ةها]\s/.test(s)) {
    date = dateKey(addDays(fromKey(today), 1))
    cut(/\sبكر[ةها]\s/)
  } else if (/\s(النهارد[ةه]|انهارد[ةه]|النهاردا|اليوم ده)\s/.test(s)) {
    date = today
    cut(/\s(النهارد[ةه]|انهارد[ةه]|النهاردا|اليوم ده)\s/)
  }
  // ٢٥ نوفمبر / يوم ٢٥ / 25/11
  if (!date) {
    for (let m = 0; m < 12 && !date; m++) {
      for (const name of MONTHS[m]) {
        const re = new RegExp(`\\s(يوم\\s)?(\\d{1,2})\\s(من\\s)?${name}\\s`)
        const x = s.match(re)
        if (x) {
          const t = fromKey(today)
          let y = t.getFullYear()
          if (m < t.getMonth() || (m === t.getMonth() && Number(x[2]) < t.getDate())) y++
          date = dateKey(new Date(y, m, Number(x[2])))
          cut(re)
          break
        }
      }
    }
  }
  if (!date) {
    const x = s.match(/\s(\d{1,2})\/(\d{1,2})\s/)
    if (x) {
      const t = fromKey(today)
      const m = Number(x[2]) - 1
      let y = t.getFullYear()
      if (m < t.getMonth() || (m === t.getMonth() && Number(x[1]) < t.getDate())) y++
      date = dateKey(new Date(y, m, Number(x[1])))
      cut(/\s(\d{1,2})\/(\d{1,2})\s/)
    }
  }
  if (!date) {
    const x = s.match(/\sيوم\s(\d{1,2})\s/)
    if (x) {
      const t = fromKey(today)
      const d = Number(x[1])
      const target = d >= t.getDate() ? new Date(t.getFullYear(), t.getMonth(), d) : new Date(t.getFullYear(), t.getMonth() + 1, d)
      date = dateKey(target)
      cut(/\sيوم\s(\d{1,2})\s/)
    }
  }
  if (!date) {
    for (const [wd, names] of WEEKDAYS) {
      const re = new RegExp(`\\s(يوم\\s)?(${names.join('|')})(\\s(الجاي|اللي جاي))?\\s`)
      if (re.test(s)) {
        date = nextWeekday(today, wd)
        cut(re)
        break
      }
    }
  }

  // الساعة
  const words = Object.keys(NUM_WORDS).join('|')
  const timeRe = new RegExp(`\\s(الساعة|الساعه|ساعة|على|ع)?\\s?(\\d{1,2}|${words})(?::(\\d{2}))?(\\s(ونص|و نص|وربع|و ربع|إلا ربع|الا ربع|الا تلت|وتلت))?(\\s(العصر|المغرب|بالليل|باليل|الليل|مساء|مساءً|بعد الضهر|بعد الظهر|م|الصبح|الصباح|صباحا|صباحًا|ص|الفجر|الضهر|الظهر))?\\s`)
  const x = s.match(timeRe)
  const hasClock = x && (x[1] || x[3] || x[5] || x[7])
  if (x && hasClock) {
    let h = /\d/.test(x[2]) ? Number(x[2]) : NUM_WORDS[x[2]]
    let mi = x[3] ? Number(x[3]) : 0
    const frac = (x[5] || '').replace(/\s/g, '')
    if (frac === 'ونص') mi = 30
    if (frac === 'وربع') mi = 15
    if (frac === 'وتلت') mi = 20
    if (frac === 'إلاربع' || frac === 'الاربع') {
      h -= 1
      mi = 45
    }
    if (frac === 'الاتلت') {
      h -= 1
      mi = 40
    }
    const q = x[7] || ''
    if (h >= 0 && h <= 23 && mi < 60) {
      if (PM_WORDS.test(` ${q} `) && h < 12) h += 12
      else if (NOON_WORDS.test(q) && h < 6) h += 12
      else if (AM_WORDS.test(` ${q} `) && h === 12) h = 0
      else if (!q && h >= 1 && h <= 7) h += 12 // "الساعة ٥" غالبًا العصر
      if (q && /بالليل|الليل|باليل/.test(q) && h === 24) h = 0
      at = `${String(h % 24).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      s = s.replace(x[0], ' ')
    }
  }

  const title = s
    .replace(/\s+/g, ' ')
    .replace(/^\s*(إني|اني|إن|ان|عشان|علشان)\s/, '')
    .trim()
  const ar = (t) => t.replace(/\d/g, (d) => AR_DIGITS[d])
  return { title: ar(title) || input.trim(), date, at, remind }
}
