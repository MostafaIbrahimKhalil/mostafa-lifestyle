// تقرير الأسبوع/الشهر: نص واحد تنسخه وتبعته لكلود يقيّم الصورة كلها
import { db } from '../db.js'
import { addDays, dateKey, fromKey, monthKey, todayKey } from './dates.js'
import { PRAYERS } from './prayer.js'
import { habitDefs, indexChecks, isDone } from './habits.js'
import { PLAN, lessonTitle, summary as hifzSummary } from './hifz.js'
import { clientLedger, earnedItems } from './work.js'
import { obligationsFor } from './wallet.js'
import { WATER_TARGET } from './day.js'

const n = (x) => Math.round(x).toLocaleString('ar-EG')
const pct = (a, b) => (b ? `${n((a / b) * 100)}٪` : '—')
const egp = (x) => `${n(x)} ج`
const short = (k) => new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(fromKey(k))

export function reportRange(kind, now = new Date()) {
  const today = todayKey(now)
  if (kind === 'week') return { from: dateKey(addDays(fromKey(today), -6)), to: today, title: 'تقرير الأسبوع' }
  // الشهر: لو إحنا في أول ٣ أيام نطلّع الشهر اللي فات كامل
  const d = fromKey(today)
  const m = d.getDate() <= 3 ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0)
  const to = dateKey(last) < today ? dateKey(last) : today
  return { from: dateKey(m), to, title: 'تقرير الشهر', mk: monthKey(m) }
}

export async function buildReport(kind, settings, now = new Date()) {
  const { from, to, title, mk } = reportRange(kind, now)
  const [checks, tasks, hifz, body, txns, obligations, clients, jobs, payments, posts, goals, debts] = await Promise.all([
    db.checks.where('date').between(from, to, true, true).toArray(),
    db.tasks.toArray(),
    db.hifzLessons.toArray(),
    db.body.orderBy('date').toArray(),
    db.txns.toArray(),
    db.obligations.toArray(),
    db.clients.toArray(),
    db.jobs.toArray(),
    db.payments.toArray(),
    db.posts.toArray(),
    db.goals.toArray(),
    db.debts.toArray(),
  ])
  const byDate = indexChecks(checks)
  const days = []
  const start = [from, settings.firstUse || from].sort().pop()
  for (let d = fromKey(start); dateKey(d) <= to; d = addDays(d, 1)) days.push(d)
  const inRange = (k) => k >= from && k <= to
  const L = []
  L.push(`${title} — مصطفى لايف ستايل`)
  L.push(`الفترة: ${short(from)} لـ ${short(to)} (${n(days.length)} يوم)`)
  const excused = days.filter((d) => byDate.get(dateKey(d))?.has('day:excused')).length
  if (excused) L.push(`أيام عذر: ${n(excused)}`)

  // ===== العادات في الفترة =====
  const defs = habitDefs(settings, tasks)
  const stats = defs.map((def) => {
    let done = 0
    let total = 0
    for (const d of days) {
      const k = dateKey(d)
      if (def.start && k < def.start) continue
      if (def.days && !def.days.includes(d.getDay())) continue
      const set = byDate.get(k)
      if (!def.noSkip && set?.has('day:excused') && !isDone(def, set)) continue
      total++
      if (isDone(def, set)) done++
    }
    return { ...def, done, total, rate: total ? done / total : null }
  })
  const S = Object.fromEntries(stats.map((s) => [s.id, s]))
  const line = (id, label) => (S[id] && S[id].total ? `${label || S[id].name}: ${n(S[id].done)} من ${n(S[id].total)} (${pct(S[id].done, S[id].total)})` : null)

  // ===== العبادة =====
  L.push('', '【العبادة】')
  for (const p of PRAYERS) {
    const k = `prayer:${p.id}`
    const q = { mosque: 0, late: 0, qada: 0 }
    for (const c of checks) if (c.item === k && q[c.value] !== undefined) q[c.value]++
    const extra = [q.mosque && `مسجد ${n(q.mosque)}`, q.late && `متأخرة ${n(q.late)}`, q.qada && `قضاء ${n(q.qada)}`].filter(Boolean).join('، ')
    const l = line(k, `صلاة ${p.name}`)
    if (l) L.push(`- ${l}${extra ? ` — ${extra}` : ''}`)
  }
  for (const [id, label] of [['tasbih', 'التسبيح بعد الصلوات'], ['adhkar:morning'], ['adhkar:evening'], ['adhkar:sleep'], ['wird'], ['fast', 'صيام الاتنين والخميس']]) {
    const l = line(id, label)
    if (l) L.push(`- ${l}`)
  }
  const wirdJuz = checks.filter((c) => c.item === 'wird' && c.value).map((c) => Number(c.value)).filter(Boolean)
  if (wirdJuz.length) L.push(`- الأجزاء اللي اتقرت: ${n(wirdJuz.length)} (من ${n(Math.min(...wirdJuz))} لـ ${n(Math.max(...wirdJuz))})`)
  const memorized = hifz.filter((r) => r.memorizedAt && inRange(r.memorizedAt)).sort((a, b) => a.id - b.id)
  const reviews = hifz.flatMap((r) => (r.reviews || []).filter((v) => inRange(v.date)))
  const hs = hifzSummary(hifz)
  L.push(
    `- الحفظ: ${memorized.length ? `حفظت ${n(memorized.reduce((s, r) => s + r.to - r.from + 1, 0))} آية (${memorized.map((r) => lessonTitle({ ...PLAN[r.id - 1], ...r })).join('، ')})` : 'ما حفظتش جديد'}، والمجموع ${n(hs.ayahs)} آية و${n(hs.surahs)} سورة كاملة`,
  )
  if (reviews.length) L.push(`- تسميع المراجعة: ${n(reviews.length)} مرة، صح ${n(reviews.filter((v) => v.ok).length)}`)

  // ===== الصحة =====
  L.push('', '【الصحة】')
  for (const [id, label] of [['gym', 'الجيم'], ['teeth:am'], ['teeth:pm'], ['nails', 'قص الضوافر'], ['plate', 'الأكل على الطبق المظبوط'], ['clean', 'من غير حاجات تزوّد'], ['water', `المية كاملة (${n(WATER_TARGET)} كوباية)`]]) {
    const l = line(id, label)
    if (l) L.push(`- ${l}`)
  }
  const waterVals = days.map((d) => Number(checks.find((x) => x.item === 'water:count' && x.date === dateKey(d))?.value) || 0)
  if (days.length) L.push(`- متوسط المية: ${n(waterVals.reduce((s, v) => s + v, 0) / days.length)} كوباية في اليوم`)
  const w = body.filter((b) => inRange(b.date))
  const before = body.filter((b) => b.date < from).pop()
  const firstW = before || w[0]
  const lastW = w[w.length - 1]
  if (lastW) L.push(`- الوزن: ${firstW && firstW !== lastW ? `من ${firstW.kg} لـ ${lastW.kg} (${lastW.kg - firstW.kg > 0 ? '+' : ''}${(Math.round((lastW.kg - firstW.kg) * 10) / 10).toLocaleString('ar-EG')} كيلو)` : `${lastW.kg} كيلو`}`)
  else L.push('- الوزن: ما اتسجلش')

  // ===== المهام والخطة =====
  L.push('', '【المهام والخطة】')
  const once = tasks.filter((t) => t.kind === 'once')
  const doneIn = once.filter((t) => t.done && t.doneDate && inRange(t.doneDate))
  const lateNow = once.filter((t) => !t.done && t.date <= to)
  L.push(`- مهام خلصت: ${n(doneIn.length)}`)
  const dailyLines = stats.filter((s) => s.aspect === 'work' && s.total)
  for (const s of dailyLines) L.push(`- ${s.name} (كل يوم): ${n(s.done)} من ${n(s.total)}`)
  if (lateNow.length) L.push(`- متأخرة لسه: ${n(lateNow.length)} — ${lateNow.slice(0, 4).map((t) => t.title).join('؛ ')}`)
  const postsIn = posts.filter((p) => inRange(p.date))
  if (postsIn.length) {
    const pub = postsIn.filter((p) => p.published || p.scheduled).length
    L.push(`- الفيديوهات: نزل ${n(pub)} من ${n(postsIn.length)} معادهم في الفترة`)
  }
  const activeGoals = goals.filter((g) => g.status !== 'done' && g.status !== 'paused' && (g.steps || []).length)
  for (const g of activeGoals.slice(0, 6)) {
    const st = g.steps
    L.push(`- ${g.title}: ${n(st.filter((x) => x.done).length)}/${n(st.length)} خطوات`)
  }

  // ===== الشغل =====
  L.push('', '【الشغل】')
  let videos = 0
  let earned = 0
  for (const j of jobs) {
    const c = clients.find((x) => x.id === j.clientId)
    if (!c) continue
    for (const it of earnedItems(j, c)) {
      if (!inRange(it.date)) continue
      earned += it.amount
      if (j.kind !== 'retainer') videos += it.n || 0
    }
  }
  const received = payments.filter((p) => inRange(p.date)).reduce((s, p) => s + p.amount, 0)
  const owed = clients.map((c) => ({ c, o: clientLedger(c, jobs, payments).owed })).filter((x) => x.o > 0.5).sort((a, b) => b.o - a.o)
  L.push(`- فيديوهات اتسلّمت: ${n(videos)}، استحقيت ${egp(earned)}، استلمت ${egp(received)}`)
  if (owed.length) L.push(`- ليك برّه: ${egp(owed.reduce((s, x) => s + x.o, 0))} — ${owed.slice(0, 4).map((x) => `${x.c.name} ${egp(x.o)}`).join('، ')}`)

  // ===== الفلوس =====
  L.push('', '【الفلوس】')
  const tIn = txns.filter((t) => inRange(t.date))
  const inc = tIn.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const exp = tIn.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const byCat = {}
  for (const t of tIn) if (t.type === 'expense') byCat[t.category || 'تانية'] = (byCat[t.category || 'تانية'] || 0) + t.amount
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  L.push(`- دخل ${egp(inc)}، صرف ${egp(exp)}، ${inc >= exp ? `فاضل ${egp(inc - exp)}` : `صرفت أكتر بـ ${egp(exp - inc)}`}`)
  if (top.length) L.push(`- أكبر بنود الصرف: ${top.slice(0, 4).map(([c, v]) => `${c} ${egp(v)}`).join('، ')}`)
  const limits = settings.budgetLimits || {}
  if (kind === 'month' && Object.keys(limits).length) {
    const over = Object.entries(limits).filter(([c, v]) => v && (byCat[c] || 0) > v)
    L.push(`- الميزانية: ${over.length ? `زاد عن الحد في ${over.map(([c, v]) => `${c} (${egp(byCat[c])} من ${egp(v)})`).join('، ')}` : 'ملتزم بكل الحدود'}`)
  }
  const saved = tIn.reduce((s, t) => s + (t.type === 'toEnvelope' ? t.amount : t.type === 'fromEnvelope' ? -t.amount : 0), 0)
  L.push(`- حوّشت في الأظرف: ${egp(saved)}`)
  const curMk = mk || monthKey(fromKey(to))
  const obls = obligationsFor(curMk, obligations, txns).filter((o) => o.due <= to && (o.paid || Number(o.amount)))
  if (obls.length) L.push(`- الالتزامات اللي جه معادها: اتدفع ${n(obls.filter((o) => o.paid).length)} من ${n(obls.length)}`)
  const myDebts = debts.filter((d) => (d.dir || 'iOwe') === 'iOwe')
  const leftDebt = myDebts.reduce((s, d) => s + Math.max(0, d.amount - (d.paid || []).reduce((a, p) => a + p.amount, 0)), 0)
  if (leftDebt) L.push(`- ديون عليّا: ${egp(leftDebt)}`)

  // ===== أقوى وأضعف =====
  const rated = stats.filter((s) => s.total >= 3 && s.rate !== null)
  const strong = [...rated].sort((a, b) => b.rate - a.rate).slice(0, 3)
  const weak = [...rated].sort((a, b) => a.rate - b.rate).filter((s) => s.rate < 0.8).slice(0, 3)
  L.push('', '【الخلاصة】')
  if (strong.length) L.push(`- أقوى حاجات: ${strong.map((s) => `${s.name} ${pct(s.done, s.total)}`).join('، ')}`)
  if (weak.length) L.push(`- أضعف حاجات: ${weak.map((s) => `${s.name} ${pct(s.done, s.total)}`).join('، ')}`)
  L.push('', 'قيّم الصورة ككل وقولي أعدّل إيه الفترة الجاية.')
  return L.join('\n')
}
