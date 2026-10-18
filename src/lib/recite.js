// تسميع بالصوت: التعرّف على الكلام العربي من الموبايل نفسه، ومقارنته بكلمات الآيات

export function speechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// نشيل التشكيل وعلامات المصحف ونوحّد الحروف اللي بتتكتب بأكتر من شكل
export function normalize(w) {
  return w
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[^ء-ي]/g, '')
}

export function splitWords(text) {
  return text
    .split(/\s+/)
    .map((raw) => ({ raw, n: normalize(raw) }))
    .filter((w) => w.n)
}

function distance(a, b) {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

// الرسم العثماني بيختلف عن الإملاء العادي (الصلوة/الصلاة)، فبنقبل فرق بسيط
export function similar(a, b) {
  if (a === b) return true
  const d = distance(a, b)
  const len = Math.max(a.length, b.length)
  // الكلمات القصيرة: حرف ناقص أو زيادة بس (مش حرف مختلف — خسر/خير)
  if (len <= 3) return d === 1 && a.length !== b.length && Math.min(a.length, b.length) >= 2
  return 1 - d / len >= 0.6
}

// بنرتّب كلامك على كلمات الآيات (أطول تطابق بالترتيب) ونعرف كل كلمة اتقالت ولا لأ
export function align(expected, spoken) {
  const m = expected.length
  const n = spoken.length
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      L[i][j] = similar(expected[i].n, spoken[j].n) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const ok = new Array(m).fill(false)
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (similar(expected[i].n, spoken[j].n) && L[i][j] === L[i + 1][j + 1] + 1) {
      ok[i] = true
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) i++
    else j++
  }
  return ok
}

// بيبدأ يسمع ويرجع دالة توقفه. onText بتاخد كل اللي اتقال لحد دلوقتي
export function listen({ onText, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new SR()
  rec.lang = 'ar-SA'
  rec.continuous = true
  rec.interimResults = true
  let finals = ''
  let stopped = false
  rec.onresult = (e) => {
    let interim = ''
    for (let k = e.resultIndex; k < e.results.length; k++) {
      const r = e.results[k]
      if (r.isFinal) finals += ' ' + r[0].transcript
      else interim += ' ' + r[0].transcript
    }
    onText((finals + interim).trim(), finals.trim(), interim.trim())
  }
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    stopped = true
    onError(e.error)
  }
  // سفاري ساعات بيقف لوحده بعد سكوت — بنكمّل طالما إنت ما دوستش "خلصت"
  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start()
        return
      } catch {
        // مكمّلين للنهاية
      }
    }
    onEnd()
  }
  rec.start()
  return () => {
    stopped = true
    try {
      rec.stop()
    } catch {
      onEnd()
    }
  }
}

export function errorText(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed')
    return 'الموبايل مش سامح للتطبيق يستخدم المايك. من الإعدادات ← سفاري ← الميكروفون خليه "اسأل" أو "سماح"، وتأكد إن Siri والإملاء شغالين.'
  if (code === 'network') return 'التعرف على الصوت محتاج نت.'
  if (code === 'audio-capture') return 'مش لاقي مايك شغال.'
  if (code === 'language-not-supported') return 'العربي مش متاح في الإملاء على الموبايل ده. ضيف العربي من إعدادات لوحة المفاتيح.'
  return `حصلت مشكلة في التسجيل (${code}).`
}

// متابعة القراية في الورد: بنمشي على كلمات الجزء ونعرف إنت وصلت لحد فين
export function makeFollower(expected, startAt = 0) {
  const LOOK = 6
  let st = { cursor: startAt, misses: 0, prev: null }
  let finalsSeen = 0

  function step(s, w) {
    for (let k = 0; k <= LOOK && s.cursor + k < expected.length; k++) {
      if (similar(expected[s.cursor + k], w.n)) {
        s.cursor += k + 1
        s.misses = 0
        s.prev = w
        return
      }
    }
    s.misses++
    // تُهت؟ ندور على الكلمتين اللي فاتوا ورا بعض في اللي جاي
    if (s.misses >= 3 && s.prev) {
      for (let j = s.cursor; j < Math.min(expected.length - 1, s.cursor + 80); j++) {
        if (similar(expected[j], s.prev.n) && similar(expected[j + 1], w.n)) {
          s.cursor = j + 2
          s.misses = 0
          break
        }
      }
    }
    s.prev = w
  }

  return {
    // بترجع لحد فين وصلت (مع الكلام اللي لسه بيتكتب)
    feed(finalsText, interimText) {
      const fw = splitWords(finalsText)
      for (let i = finalsSeen; i < fw.length; i++) step(st, fw[i])
      finalsSeen = fw.length
      const t = { ...st }
      for (const w of splitWords(interimText)) step(t, w)
      return Math.max(st.cursor, t.cursor)
    },
    restart() {
      finalsSeen = 0
    },
    get cursor() {
      return st.cursor
    },
    moveTo(i) {
      st = { cursor: i, misses: 0, prev: null }
    },
  }
}
