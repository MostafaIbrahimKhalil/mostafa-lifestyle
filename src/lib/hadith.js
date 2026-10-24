// الأحاديث: الأربعون النووية ورياض الصالحين (من public/data/hadith)، وحديث كل يوم
import { fromKey } from './dates.js'
import { normalize } from './recite.js'

export const BOOKS = [
  { id: 'nawawi', title: 'الأربعون النووية', count: 42 },
  { id: 'riyad', title: 'رياض الصالحين', count: 1896 },
]

const cache = {}
export function loadBook(id) {
  cache[id] ||= fetch(`${import.meta.env.BASE_URL}data/hadith/${id}.json`)
    .then((r) => {
      if (!r.ok) throw new Error('ما قدرش يفتح الكتاب')
      return r.json()
    })
    .catch((e) => {
      delete cache[id]
      throw e
    })
  return cache[id]
}

// حديث اليوم: الأربعين النووية الأول (٤٢ يوم)، وبعدها رياض الصالحين بالترتيب
const START = '2026-10-24'
export function dayIndex(dateK) {
  return Math.max(0, Math.round((fromKey(dateK) - fromKey(START)) / 86400000))
}

export async function hadithOfDay(dateK, shift = 0) {
  let i = dayIndex(dateK) + shift
  const nawawi = await loadBook('nawawi')
  const flatN = flatten(nawawi)
  if (i < flatN.length) return { ...flatN[i], book: nawawi.title }
  i -= flatN.length
  const riyad = await loadBook('riyad')
  const flatR = flatten(riyad)
  return { ...flatR[i % flatR.length], book: riyad.title }
}

const flat = new WeakMap()
export function flatten(book) {
  if (!flat.has(book)) {
    const out = []
    book.chapters.forEach((c, ci) => c.hadiths.forEach((text, hi) => out.push({ text, ci, hi, chapter: c.title, n: out.length + 1 })))
    flat.set(book, out)
  }
  return flat.get(book)
}

// البحث من غير تشكيل ولا همزات
const norm = new WeakMap()
export function search(book, q, limit = 60) {
  // من غير "ال" عشان "الجار" تلاقي "جاره" و"بالجار" كمان
  const words = q.split(/\s+/).map(normalize).map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w)).filter(Boolean)
  if (!words.length) return []
  const all = flatten(book)
  if (!norm.has(book)) norm.set(book, all.map((h) => h.text.split(/\s+/).map(normalize).join(' ')))
  const ns = norm.get(book)
  const out = []
  for (let i = 0; i < all.length && out.length < limit; i++) if (words.every((w) => ns[i].includes(w))) out.push(all[i])
  return out
}

export const favKey = (bookId, h) => `${bookId}:${h.ci}:${h.hi}`
