// الشغل والحسابات: الطلبات، التسليم، الاستحقاق، والدفعات وتوزيعها
import { db, getSetting, setSetting } from '../db.js'
import { daysInMonth, formatMonth, fromKey, minutesBetween, monthKey, todayKey } from './dates.js'

export const CLIENT_KINDS = {
  retainer: 'راتب / باقة شهرية',
  perVideo: 'بالفيديو',
  perJob: 'بالشغلانة',
}

export const INCOME_GOAL = 100000

export function money(n) {
  return `${Math.round(n || 0).toLocaleString('ar-EG')} ج`
}

// معاد استحقاق باقة شهر معيّن
export function retainerDueDate(client, month) {
  const [y, m] = month.split('-').map(Number)
  const last = daysInMonth(y, m - 1)
  const day = client.dueDay ? Math.min(client.dueDay, last) : last
  return `${month}-${String(day).padStart(2, '0')}`
}

// ===== البيانات المبدئية (مرة واحدة) =====
export async function seedClients() {
  if (await getSetting('seededClients', false)) return
  if ((await db.clients.count()) === 0) {
    const m = monthKey(new Date())
    await db.clients.bulkAdd([
      { name: 'سمير (الإمارات)', kind: 'retainer', rate: 25000, dueDay: 0, note: 'بيتأخر من ١٠ لـ ٢٠ يوم', startMonth: m, active: true, order: 1 },
      { name: 'مكتب الزمالك', kind: 'retainer', rate: 25000, dueDay: 0, note: 'من ٩ لـ ٥', startMonth: '2026-11', active: true, order: 2 },
      { name: 'أحمد سمير', kind: 'perVideo', rate: 300, note: 'فيديوهات الدروس', active: true, order: 3 },
      { name: 'عمر هشام', kind: 'perVideo', rate: 500, note: 'من ٥٠٠ لـ ١٠٠٠ على حسب الفيديو', active: true, order: 4 },
      { name: 'وكالة الأخبار', kind: 'perVideo', rate: 800, note: 'تقارير إخبارية', active: true, order: 5 },
      { name: 'شغل صغير', kind: 'perJob', rate: 1500, note: 'إعلانات وحاجات في النص', active: true, order: 6 },
    ])
  }
  await setSetting('seededClients', true)
}

// كل عميل شهري ليه طلب "باقة الشهر" لكل شهر من بدايته لحد الشهر الحالي
export async function ensureRetainerJobs() {
  const all = (await db.clients.toArray()).filter((c) => c.active !== false)
  const nowM = monthKey(new Date())
  for (const c of all.filter((c) => c.kind === 'retainer')) {
    let m = c.startMonth || nowM
    while (m <= nowM) {
      const exists = await db.jobs.where('clientId').equals(c.id).filter((j) => j.kind === 'retainer' && j.month === m).count()
      if (!exists) {
        await db.jobs.add({
          clientId: c.id,
          kind: 'retainer',
          title: 'راتب / باقة الشهر',
          month: m,
          qty: null,
          delivered: 0,
          deliveries: [],
          total: c.rate,
          receivedDate: `${m}-01`,
          deadline: retainerDueDate(c, m),
          createdAt: new Date().toISOString(),
        })
      }
      const [y, mm] = m.split('-').map(Number)
      m = monthKey(new Date(y, mm, 1))
    }
  }
}

// ===== الحسابات =====

// الفلوس اللي اتكسبت من طلب: بنودها بتاريخ كل واحد (للتوزيع والإحصائيات)
export function earnedItems(job, client, today = todayKey()) {
  if (job.cancelled) return []
  if (job.kind === 'retainer') {
    const due = job.deadline || retainerDueDate(client, job.month)
    // الباقة بتتحسب على شهرها، ومستحقة في معادها
    return [{ date: `${job.month}-01`, due, amount: job.total || 0, n: job.delivered || 0, isDue: due <= today }]
  }
  const per = job.kind === 'perJob' && job.qty ? (job.total || 0) / job.qty : job.unitPrice || 0
  return (job.deliveries || []).map((d) => ({ date: d.date, due: d.date, amount: per * d.n, n: d.n, isDue: true }))
}

// توزيع الدفعات على الشغل: المربوطة بطلب الأول، والباقي من الأقدم للأحدث
export function clientLedger(client, jobs, payments, today = todayKey()) {
  const myJobs = jobs.filter((j) => j.clientId === client.id && !j.cancelled)
  const myPays = payments.filter((p) => p.clientId === client.id)
  const items = []
  for (const j of myJobs) for (const it of earnedItems(j, client, today)) items.push({ ...it, jobId: j.id, paid: 0 })
  items.sort((a, b) => a.date.localeCompare(b.date) || a.jobId - b.jobId)

  let free = 0
  for (const p of myPays) {
    let left = p.amount
    if (p.jobId) {
      for (const it of items.filter((x) => x.jobId === p.jobId)) {
        const take = Math.min(left, it.amount - it.paid)
        it.paid += take
        left -= take
      }
    }
    free += left
  }
  for (const it of items) {
    const take = Math.min(free, it.amount - it.paid)
    it.paid += take
    free -= take
  }

  const perJob = {}
  for (const it of items) {
    const r = (perJob[it.jobId] ||= { earned: 0, paid: 0, dueOwed: 0, oldestUnpaid: null })
    r.earned += it.amount
    r.paid += it.paid
    if (it.isDue && it.paid < it.amount - 0.5) {
      r.dueOwed += it.amount - it.paid
      if (!r.oldestUnpaid || it.due < r.oldestUnpaid) r.oldestUnpaid = it.due
    }
  }
  const earned = items.reduce((s, x) => s + x.amount, 0)
  const paid = myPays.reduce((s, p) => s + p.amount, 0)
  const dueOwed = items.filter((x) => x.isDue).reduce((s, x) => s + (x.amount - x.paid), 0)
  const oldest = items.filter((x) => x.isDue && x.paid < x.amount - 0.5).map((x) => x.due).sort()[0] || null
  return {
    client,
    earned,
    paid,
    owed: Math.max(0, earned - paid), // كل اللي ليك (حتى اللي لسه معاده ما جاش)
    dueOwed: Math.max(0, dueOwed), // اللي معاده جه ولسه ما اتدفعش
    credit: Math.max(0, paid - earned), // دفع زيادة / مقدّم
    oldestUnpaid: oldest,
    lateDays: oldest ? Math.max(0, Math.round(minutesBetween(fromKey(oldest), fromKey(today)) / 1440)) : 0,
    perJob,
    jobs: myJobs,
    payments: myPays,
  }
}

export function jobStatus(job) {
  if (job.cancelled) return 'cancelled'
  if (job.kind === 'retainer') return 'retainer'
  if (job.qty && job.delivered >= job.qty) return 'delivered'
  if (job.delivered > 0) return 'partial'
  return 'todo'
}

export function payStatus(job, ledgerRow) {
  if (!ledgerRow || ledgerRow.earned <= 0) return job.kind === 'retainer' ? 'notdue' : 'nothing'
  if (ledgerRow.paid >= ledgerRow.earned - 0.5) return 'paid'
  if (ledgerRow.paid > 0) return 'partpaid'
  return 'unpaid'
}

// إحصائيات شهر: الفيديوهات اللي اتسلّمت، اللي اتكسب، اللي اتقبض
export function monthStats(mk, clients, jobs, payments) {
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]))
  const perClient = {}
  let videos = 0
  let earned = 0
  for (const j of jobs) {
    if (j.cancelled) continue
    const c = byId[j.clientId]
    if (!c) continue
    const row = (perClient[c.id] ||= { client: c, videos: 0, earned: 0, received: 0 })
    if (j.kind === 'retainer') {
      if (j.month === mk) {
        row.earned += j.total || 0
        earned += j.total || 0
        row.videos += j.delivered || 0
        videos += j.delivered || 0
      }
      continue
    }
    const per = j.kind === 'perJob' && j.qty ? (j.total || 0) / j.qty : j.unitPrice || 0
    for (const d of j.deliveries || []) {
      if (!d.date.startsWith(mk)) continue
      row.videos += d.n
      videos += d.n
      row.earned += per * d.n
      earned += per * d.n
    }
  }
  let received = 0
  for (const p of payments) {
    if (!p.date.startsWith(mk)) continue
    received += p.amount
    const c = byId[p.clientId]
    if (c) (perClient[c.id] ||= { client: c, videos: 0, earned: 0, received: 0 }).received += p.amount
  }
  return { videos, earned, received, perClient: Object.values(perClient).sort((a, b) => b.earned - a.earned) }
}

// تسجيل تسليم فيديو (أو أكتر) لطلب
export async function deliver(job, n = 1, date = todayKey()) {
  await db.transaction('rw', db.jobs, async () => {
    const j = await db.jobs.get(job.id)
    const deliveries = [...(j.deliveries || [])]
    const ex = deliveries.find((d) => d.date === date)
    if (ex) ex.n += n
    else deliveries.push({ date, n })
    // التراجع: نشيل من آخر تسليم
    if (n < 0) {
      let left = -n
      for (let i = deliveries.length - 1; i >= 0 && left > 0; i--) {
        const take = Math.min(left, Math.max(0, deliveries[i].n))
        deliveries[i].n -= take
        left -= take
      }
    }
    const clean = deliveries.filter((d) => d.n > 0)
    await db.jobs.update(job.id, { deliveries: clean, delivered: clean.reduce((s, d) => s + d.n, 0) })
  })
}

export function lastMonths(n, from = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)))
  return out
}

export function deadlineInfo(job, today = todayKey()) {
  if (!job.deadline || job.kind === 'retainer') return null
  const days = Math.round(minutesBetween(fromKey(today), fromKey(job.deadline)) / 1440)
  return { days, late: days < 0 }
}


export function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number)
  return formatMonth(y, m - 1)
}
