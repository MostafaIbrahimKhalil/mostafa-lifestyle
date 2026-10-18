// سيستم التمرين: ٣ أيام حديد/كارديو ثابتة + يوم مشي اختياري
// getDay(): الأحد ٠ ... السبت ٦

export const EXERCISES = {
  legpress: {
    name: 'ليج بريس',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'رجلك بعرض كتفك على الدواسة، انزل لحد ما ركبتك تبقى زاوية قايمة، وادفع بكعبك.',
    mistake: 'ما تقفلش ركبتك على الآخر وإنت طالع.',
    step: 5,
  },
  chestpress: {
    name: 'تشيست بريس بالجهاز',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'ضهرك لازق في المسند، ادفع لقدّام وارجع ببطء في ٣ ثواني.',
    mistake: 'ما ترفعش كتفك لفوق ناحية ودنك.',
    step: 2.5,
  },
  latpulldown: {
    name: 'لات بول داون',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'امسك البار أعرض من كتفك، شدّه لحد فوق صدرك وانت بتضم لوح كتفك لورا.',
    mistake: 'ما ترجعش بجسمك لورا كتير عشان تشد.',
    step: 2.5,
  },
  shoulderpress: {
    name: 'كتف بالجهاز',
    sets: 3,
    reps: [10, 15],
    rest: 75,
    tip: 'ادفع لفوق من غير ما تقفل كوعك، وانزل لحد مستوى ودنك.',
    mistake: 'ما تقوّسش ضهرك.',
    step: 2.5,
  },
  plank: {
    name: 'بلانك',
    sets: 3,
    reps: [30, 45],
    unit: 'ثانية',
    rest: 60,
    noWeight: true,
    tip: 'على كوعك ورجلك، جسمك خط مستقيم من راسك لكعبك، وشد بطنك.',
    mistake: 'ما تنزّلش وسطك ولا ترفعه لفوق.',
  },
  goblet: {
    name: 'جوبلت سكوات بالدمبل',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'امسك دمبل قدام صدرك، انزل كأنك هتقعد على كرسي، وضهرك مفرود.',
    mistake: 'ما تخليش ركبتك تدخل لجوه.',
    step: 2,
  },
  seatedrow: {
    name: 'سيتد رو',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'ضهرك مفرود، اسحب المقبض لبطنك وضم لوح كتفك، وارجع ببطء.',
    mistake: 'ما تهزّش جسمك لقدام وورا.',
    step: 2.5,
  },
  inclinedb: {
    name: 'دمبل بنش مايل',
    sets: 3,
    reps: [8, 12],
    rest: 90,
    tip: 'البنش على ٣٠ درجة، انزل بالدمبل لحد جنب صدرك وادفع لفوق.',
    mistake: 'ما تخبطش الدمبلز في بعض فوق.',
    step: 2,
  },
  legcurl: {
    name: 'ليج كيرل',
    sets: 3,
    reps: [10, 15],
    rest: 75,
    tip: 'اثني ركبتك وشد الجهاز ناحيتك ببطء، وارجع في ٣ ثواني.',
    mistake: 'ما ترفعش وسطك من الكرسي.',
    step: 2.5,
  },
  abcrunch: {
    name: 'بطن بالجهاز',
    sets: 3,
    reps: [10, 15],
    rest: 60,
    tip: 'لف جسمك لقدام بعضلة البطن، مش بإيدك.',
    mistake: 'ما تشدّش رقبتك.',
    step: 2.5,
  },
}

export const ROUTINES = {
  A: { name: 'حديد A', exercises: ['legpress', 'chestpress', 'latpulldown', 'shoulderpress', 'plank'], cardio: 20 },
  B: { name: 'حديد B', exercises: ['goblet', 'seatedrow', 'inclinedb', 'legcurl', 'abcrunch'], cardio: 20 },
  cardio: { name: 'كارديو', exercises: [], cardio: 40, walk: 60 },
  walk: { name: 'مشي', exercises: [], walk: 60, optional: true },
}

export const CARDIO_KINDS = [
  ['walk', 'مشي'],
  ['treadmill', 'مشاية بميل'],
  ['elliptical', 'إيروبك (إليبتكال)'],
  ['bike', 'عجلة'],
]

// الجدول الافتراضي: السبت مشي، الحد A، التلات كارديو، الخميس B، والجمعة راحة
export const DEFAULT_GYM_DAYS = { 6: 'walk', 0: 'A', 2: 'cardio', 4: 'B' }
export const DEFAULT_GYM_TIME = '17:00'

export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]
export const DAY_NAMES = { 6: 'السبت', 0: 'الحد', 1: 'الاتنين', 2: 'التلات', 3: 'الأربع', 4: 'الخميس', 5: 'الجمعة' }

export function routineFor(day, settings) {
  const days = settings.gymDays || DEFAULT_GYM_DAYS
  const id = days[day.getDay()]
  return id ? { id, ...ROUTINES[id] } : null
}

// اليوم ده محسوب في الالتزام؟ (المشي الاختياري مش محسوب)
export function isGymDay(day, settings) {
  const r = routineFor(day, settings)
  return !!r && !r.optional
}

export function gymWeekdays(settings) {
  const days = settings.gymDays || DEFAULT_GYM_DAYS
  return Object.entries(days)
    .filter(([, id]) => !ROUTINES[id]?.optional)
    .map(([d]) => Number(d))
}

// الوزن المقترح للمرة دي على حسب آخر مرة: لو كل المجموعات وصلت لأقصى عدّات، زوّد
export function suggestion(exId, lastSets) {
  const ex = EXERCISES[exId]
  if (!lastSets?.length) return { weight: null, reps: ex.reps[0], note: 'أول مرة: اختار وزن آخر عدّتين فيه صعبين' }
  const w = Math.max(...lastSets.map((s) => Number(s.w) || 0))
  const allTop = lastSets.length >= ex.sets && lastSets.every((s) => Number(s.r) >= ex.reps[1])
  if (ex.noWeight) {
    return allTop
      ? { weight: null, reps: ex.reps[1] + 5, note: `زوّد ٥ ${ex.unit || 'عدّات'}` }
      : { weight: null, reps: Math.max(...lastSets.map((s) => Number(s.r) || 0)), note: 'حاول توصل للأقصى' }
  }
  if (allTop) return { weight: w + (ex.step || 2.5), reps: ex.reps[0], note: `زوّد ${ex.step || 2.5} كيلو 💪` }
  return { weight: w, reps: ex.reps[0], note: `نفس الوزن، وحاول توصل ${ex.reps[1]} عدّة` }
}
