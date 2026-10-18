// "اكتب زي ما بتتكلم": جملة بالمصري ← حركة في المحفظة (من غير نت ومن غير ذكاء اصطناعي)
import { addDays, dateKey, todayKey } from './dates.js'

const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 }
const NUM_WORDS = [
  ['ألفين', 2000], ['الفين', 2000], ['تلت تلاف', 3000], ['ألف', 1000], ['الف', 1000],
  ['تسعمية', 900], ['تمنمية', 800], ['سبعمية', 700], ['ستمية', 600], ['خمسمية', 500],
  ['ربعمية', 400], ['تلتمية', 300], ['ميتين', 200], ['مية', 100], ['ميه', 100],
]

export function normalizeDigits(s) {
  return s.replace(/[٠-٩]/g, (d) => AR_DIGITS[d]).replace(/٫/g, '.').replace(/[٬,](?=\d{3})/g, '')
}

// أول مبلغ في الجملة: ٢٥ ألف، ٢٥٠٠٠، ألف و٥٠٠، خمسمية
export function parseAmount(text) {
  const t = normalizeDigits(text)
  const k = t.match(/(ألفين|الفين|ألف|الف)\s*و\s*(\d+)/)
  if (k) return { amount: (/ين$/.test(k[1]) ? 2000 : 1000) + Number(k[2]), raw: k[0] }
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ألف|الف|آلاف|الاف|تلاف|k)?(?:\s*و\s*(\d+))?/i)
  if (m) {
    let v = Number(m[1])
    if (m[2]) v *= 1000
    if (m[3]) v += Number(m[3])
    return { amount: v, raw: m[0] }
  }
  for (const [w, v] of NUM_WORDS) {
    const re = new RegExp(`(^|\\s|ب)${w}(?=\\s|$)`)
    if (re.test(t)) return { amount: v, raw: w }
  }
  return null
}

const CAT_WORDS = [
  ['مواصلات', ['اوبر', 'أوبر', 'كريم', 'تاكسي', 'مترو', 'بنزين', 'عربية', 'توكتوك', 'ميكروباص', 'باص', 'مواصلات', 'ركنة', 'جراج', 'اندرايف', 'إندرايف']],
  ['مدرسة وعيال', ['مدرسة', 'زين', 'حفاض', 'بامبرز', 'لبن اطفال', 'لبن أطفال', 'العيال', 'المولود', 'البيبي', 'حضانة', 'دروس', 'كتب']],
  ['فواتير واشتراكات', ['فاتورة', 'كهربا', 'كهرباء', 'غاز', 'النت', 'نت ', 'انترنت', 'إنترنت', 'كارت', 'شحن', 'اشتراك', 'ايجار', 'إيجار', 'قسط']],
  ['صحة', ['دكتور', 'دكتورة', 'دوا', 'دواء', 'صيدلية', 'تحاليل', 'كشف', 'اشعة', 'أشعة', 'جيم']],
  ['لبس', ['لبس', 'هدوم', 'جزمة', 'كوتشي', 'قميص', 'بنطلون', 'جاكيت', 'ترنج']],
  ['هدايا ومناسبات', ['هدية', 'هدايا', 'عيد', 'فرح', 'نقطة', 'عزومة', 'مناسبة', 'عيدية']],
  ['شغل وأدوات', ['ادوبي', 'أدوبي', 'هارد', 'كاميرا', 'لابتوب', 'لاب', 'ميكروفون', 'مايك', 'claude', 'كلود', 'elevenlabs', 'برنامج', 'سيرفر']],
  ['أكل وبيت', ['أكل', 'اكل', 'غدا', 'عشا', 'فطار', 'سوبر', 'ماركت', 'خضار', 'فاكهة', 'لحمة', 'فراخ', 'سمك', 'عيش', 'بقالة', 'طلبات', 'قهوة', 'شاي', 'مشروب', 'عصير', 'مية معدنية', 'كافيه', 'مطعم', 'ديليفري', 'منظفات', 'البيت']],
  ['شخصي', ['حلاق', 'سجاير', 'شخصي', 'خروجة', 'سينما']],
]

export function guessCategory(text) {
  const t = ` ${text} `
  for (const [cat, words] of CAT_WORDS) if (words.some((w) => t.includes(w))) return cat
  return 'تانية'
}

const clean = (s) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^[\s،,.-]+|[\s،,.-]+$/g, '')
    .trim()

// بنشيل الكلمات الزيادة عشان يفضل الاسم بس
function stripWords(text, words) {
  let t = ` ${text} `
  for (const w of words) t = t.replace(new RegExp(`\\s${w}\\s`, 'g'), ' ')
  return clean(t)
}

const FILLER = ['ب', 'بـ', 'جنيه', 'ج', 'جم', 'على', 'في', 'من', 'ل', 'لـ', 'عند', 'كل', 'شهر', 'شهري', 'شهريا', 'شهرياً', 'النهارده', 'امبارح', 'كاش', 'انستاباي', 'إنستاباي', 'يوم', 'ال']

function personAfter(text, preps) {
  for (const p of preps) {
    const m = text.match(new RegExp(`(?:^|\\s)${p}\\s*([\\u0600-\\u06FFa-zA-Z][\\u0600-\\u06FFa-zA-Z ]{0,25})`))
    if (m) {
      const name = clean(m[1].replace(/\d+|ألف|الف|جنيه|كل شهر|امبارح|النهارده/g, ''))
      if (name) return name.split(' ').slice(0, 2).join(' ')
    }
  }
  return ''
}

// النتيجة: { type, amount, ... , label } — type: expense | income | iOwe | owedMe | obligation | payObligation | toEnvelope | goal | gold
export function parseQuick(input, ctx = {}) {
  const text = clean(normalizeDigits(input))
  if (!text) return null
  const a = parseAmount(text)
  const amount = a?.amount || 0
  const date = /امبارح|إمبارح/.test(text) ? dateKey(addDays(new Date(), -1)) : todayKey()
  const accountHint = /انستا|إنستا|محفظة|فودافون/.test(text) ? 'wallet' : /بنك|فيزا|كارت بنك/.test(text) ? 'bank' : /دهب|ذهب/.test(text) ? 'gold' : 'cash'
  const body = a ? clean(text.replace(a.raw, ' ')) : text
  const base = { amount, date, accountHint, text }

  // دين عليّا
  if (/^(عليا|عليّا|عليّ|علي ليا)\s|استلفت|اتسلفت/.test(text)) {
    const person = personAfter(body, ['ل', 'لـ', 'من', 'عند']) || stripWords(body.replace(/^(عليا|عليّا|عليّ)|استلفت|اتسلفت/, ''), FILLER)
    return { ...base, type: 'iOwe', person, label: `دين عليك لـ ${person || '…'}` }
  }
  // فلوس ليّا عند حد
  if (/^(ليا|ليّا)\s|سلفت|سلّفت|عليه ليا|عليها ليا|(\S+)\s+(عليه|عليها)\s/.test(text)) {
    let person = personAfter(body, ['عند', 'ل', 'لـ'])
    if (!person) {
      const m = text.match(/(\S+(?:\s\S+)?)\s+(عليه|عليها)/) || text.match(/سل(?:ّ)?فت\s+(\S+)/)
      person = m ? clean(m[1].replace(/^ليا\s*/, '')) : ''
    }
    return { ...base, type: 'owedMe', person, label: `فلوس ليك عند ${person || '…'}` }
  }
  // التزام شهري: فاتورة/اشتراك/قسط/إيجار + كل شهر
  if (/كل شهر|شهري|شهريا|شهرياً|في الشهر/.test(text)) {
    const dayM = text.match(/يوم\s*(\d{1,2})/)
    const name = stripWords(body.replace(/يوم\s*\d{1,2}/, '').replace(/كل شهر|في الشهر/g, ''), FILLER) || 'التزام'
    const kind = /كهربا|كهرباء|مية|غاز|كارت|شحن/.test(text) ? 'bill' : 'fixed'
    return {
      ...base,
      type: 'obligation',
      name: name.replace(/^فاتورة\s+/, ''),
      kind,
      dueDay: dayM ? Number(dayM[1]) : 1,
      category: guessCategory(text) === 'تانية' ? 'فواتير واشتراكات' : guessCategory(text),
      label: `التزام ${kind === 'bill' ? 'فاتورة بتتغير' : 'ثابت'} كل شهر`,
    }
  }
  // دفعت فاتورة/التزام موجود
  const obl = (ctx.obligations || []).find((o) => o.active !== false && text.includes(o.name.split(' ')[0]))
  if (/^دفعت|اتدفع|سددت|سدّدت/.test(text) && obl) {
    return { ...base, type: 'payObligation', obligation: obl, category: obl.category, label: `دفعت ${obl.name}` }
  }
  // سددت دين
  const debt = (ctx.debts || []).find((d) => d.person && text.includes(d.person))
  if (/سددت|سدّدت|رجعت|رجّعت|دفعت/.test(text) && debt && (debt.dir || 'iOwe') === 'iOwe') {
    return { ...base, type: 'payDebt', debt, label: `سددت جزء من دينك لـ ${debt.person}` }
  }
  if (/رجعلي|رجّعلي|رجعتلي|سددلي|ادّاني|اداني|اديني/.test(text) && debt && debt.dir === 'owedMe') {
    return { ...base, type: 'collectDebt', debt, label: `${debt.person} رجّعلك جزء` }
  }
  // دخل: قبضت/استلمت/جالي/وصلني/دخلي
  if (/قبضت|استلمت|جالي|جاتلي|وصلني|وصلتني|دخلي|دخلّي|حولي|حوّلي|اتحولي/.test(text)) {
    const client = (ctx.clients || []).find((c) => c.active !== false && text.includes(c.name.split(' ')[0]))
    return {
      ...base,
      type: 'income',
      client,
      category: client ? 'شغل' : /هدية|عيدية/.test(text) ? 'هدية' : 'شغل',
      note: client ? client.name : stripWords(body.replace(/قبضت|استلمت|جالي|جاتلي|وصلني|وصلتني|دخلي|دخلّي/, ''), FILLER),
      label: client ? `دخل من ${client.name} (يتسجل في الشغل كمان)` : 'دخل',
    }
  }
  // تحويش في ظرف
  if (/حوشت|حوّشت|حطيت في|ظرف/.test(text)) {
    const env = (ctx.envelopes || []).find((e) => text.includes(e.name.replace(/^ال/, '')))
    return { ...base, type: 'toEnvelope', envelope: env, label: env ? `تحويش في ظرف ${env.name}` : 'تحويش (اختار الظرف)' }
  }
  // دهب
  if (/دهب|ذهب/.test(text) && /اشتريت|جبت/.test(text)) {
    const g = text.match(/(\d+(?:\.\d+)?)\s*(جرام|جم|g)/)
    const rest = parseAmount(g ? text.replace(g[0], ' ') : text)
    return { ...base, type: 'gold', grams: g ? Number(g[1]) : 0, amount: rest?.amount || 0, label: 'اشتريت دهب' }
  }
  // عايز أشتري / شراء ← ظرف بهدف
  if (/عايز اشتري|عايز أشتري|هشتري|نفسي اشتري|نفسي أشتري|^شراء|محتاج اشتري|محتاج أشتري/.test(text)) {
    const name = stripWords(body.replace(/عايز اشتري|عايز أشتري|هشتري|نفسي اشتري|نفسي أشتري|^شراء|محتاج اشتري|محتاج أشتري/, ''), FILLER)
    const env = (ctx.envelopes || []).find((e) => name && (e.name.includes(name) || name.includes(e.name.replace(/^ال/, ''))))
    return { ...base, type: 'goal', name: name || 'حاجة', envelope: env, label: env ? `هدف ظرف ${env.name}` : `ظرف جديد: ${name}` }
  }
  // أي حاجة فيها مبلغ = صرف
  if (amount) {
    const note = stripWords(body.replace(/^(اشتريت|صرفت|دفعت|جبت|دفعنا|اتصرف)/, ''), FILLER)
    const cat = guessCategory(text)
    return { ...base, type: 'expense', category: cat, note, label: `صرف — ${cat}` }
  }
  return { ...base, type: 'unknown', label: 'مش فاهم الجملة دي، جرّب تكتب المبلغ' }
}

export const QUICK_EXAMPLES = [
  'اشتريت قهوة ب ٤٠',
  'عليّا ٥٠٠ لأحمد',
  'ليا ٣٠٠ عند كريم',
  'فاتورة النت ٣٥٠ كل شهر يوم ٥',
  'دفعت الكهربا ٤٥٠',
  'قبضت ٢٥ ألف من سمير انستاباي',
  'عايز اشتري مشاية ب ١٥ ألف',
]
