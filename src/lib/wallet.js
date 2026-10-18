// المحفظة: الحسابات، الحركات، الأظرف، الالتزامات، المشتريات، وعليّا
import { db, getSetting, setSetting } from '../db.js'
import { daysInMonth, monthKey, todayKey } from './dates.js'

export const ACCOUNT_TYPES = {
  cash: 'كاش',
  wallet: 'محفظة / إنستاباي',
  bank: 'بنك',
  gold: 'دهب (بالجرام)',
}

export const CATEGORIES = [
  'أكل وبيت',
  'مواصلات',
  'مدرسة وعيال',
  'فواتير واشتراكات',
  'صحة',
  'لبس',
  'شخصي',
  'هدايا ومناسبات',
  'شغل وأدوات',
  'تانية',
]

export const INCOME_CATS = ['شغل', 'هدية', 'تانية']

export async function seedWallet() {
  if (await getSetting('seededWallet', false)) return
  if ((await db.accounts.count()) === 0) {
    await db.accounts.bulkAdd([
      { name: 'كاش', type: 'cash', opening: 0, order: 1, active: true },
      { name: 'إنستاباي', type: 'wallet', opening: 0, order: 2, active: true },
      { name: 'دهب', type: 'gold', opening: 0, order: 3, active: true },
    ])
  }
  if ((await db.envelopes.count()) === 0) {
    const names = ['المصيف', 'مدرسة زين', 'المطبخ', 'تجديد الأوض', 'المشاية', 'عملية الليزك', 'زراعة الأسنان']
    await db.envelopes.bulkAdd(names.map((name, i) => ({ name, target: 0, kind: 'cash', priority: i + 1, active: true })))
  }
  await setSetting('seededWallet', true)
}

// ===== الأرصدة =====
export function balances(accounts, txns, envelopes) {
  const acc = Object.fromEntries(accounts.map((a) => [a.id, Number(a.opening) || 0]))
  const env = Object.fromEntries(envelopes.map((e) => [e.id, 0]))
  for (const t of txns) {
    const a = Number(t.amount) || 0
    switch (t.type) {
      case 'income':
        acc[t.accountId] = (acc[t.accountId] || 0) + a
        break
      case 'expense':
        acc[t.accountId] = (acc[t.accountId] || 0) - a
        break
      case 'adjust':
        acc[t.accountId] = (acc[t.accountId] || 0) + a
        break
      case 'transfer':
        acc[t.accountId] = (acc[t.accountId] || 0) - a
        acc[t.toAccountId] = (acc[t.toAccountId] || 0) + (t.toAmount ?? a)
        break
      case 'toEnvelope':
        acc[t.accountId] = (acc[t.accountId] || 0) - a
        env[t.envelopeId] = (env[t.envelopeId] || 0) + a
        break
      case 'fromEnvelope':
        env[t.envelopeId] = (env[t.envelopeId] || 0) - a
        acc[t.accountId] = (acc[t.accountId] || 0) + a
        break
    }
  }
  return { acc, env }
}

export function valueOf(account, amount, goldPrice) {
  return account.type === 'gold' ? amount * (goldPrice || 0) : amount
}

export function egp(n) {
  return `${Math.round(n || 0).toLocaleString('ar-EG')} ج`
}

export function grams(n) {
  return `${(Math.round((n || 0) * 100) / 100).toLocaleString('ar-EG')} جم`
}

// الالتزامات: معادها في الشهر، واتدفعت ولا لأ
export function obligationsFor(mk, obligations, txns) {
  const [y, m] = mk.split('-').map(Number)
  const last = daysInMonth(y, m - 1)
  return obligations
    .filter((o) => o.active !== false)
    .map((o) => {
      const paidTx = txns.find((t) => t.obligationId === o.id && t.month === mk)
      const day = Math.min(o.dueDay || last, last)
      return { ...o, due: `${mk}-${String(day).padStart(2, '0')}`, paid: !!paidTx, paidTx }
    })
    .sort((a, b) => a.due.localeCompare(b.due))
}

export function debtLeft(d) {
  return Math.max(0, (Number(d.amount) || 0) - (d.paid || []).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

export function monthFlow(mk, txns) {
  let income = 0
  let expense = 0
  const byCat = {}
  for (const t of txns) {
    if (!t.date?.startsWith(mk)) continue
    if (t.type === 'income') income += Number(t.amount) || 0
    if (t.type === 'expense') {
      expense += Number(t.amount) || 0
      byCat[t.category || 'تانية'] = (byCat[t.category || 'تانية'] || 0) + (Number(t.amount) || 0)
    }
  }
  return { income, expense, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]) }
}

export async function addTxn(t) {
  return db.txns.add({ date: todayKey(), month: monthKey(new Date()), ...t, createdAt: new Date().toISOString() })
}

// ===== ميزانية الشهر =====
// الالتزامات نوعين: ثابت (إيجار، نت، اشتراك) وفاتورة بتتغير (كهربا، مية، غاز)
export const OBLIGATION_KINDS = { fixed: 'ثابت', bill: 'فاتورة بتتغير' }
const BUDGET_DEFAULT_OBLIGATIONS = [
  { name: 'الإيجار', kind: 'fixed', category: 'فواتير واشتراكات', dueDay: 1 },
  { name: 'النت', kind: 'fixed', category: 'فواتير واشتراكات', dueDay: 5 },
  { name: 'اشتراكات (أدوبي، Claude…)', kind: 'fixed', category: 'شغل وأدوات', dueDay: 1 },
  { name: 'الكهربا', kind: 'bill', category: 'فواتير واشتراكات', dueDay: 10 },
  { name: 'المية', kind: 'bill', category: 'فواتير واشتراكات', dueDay: 10 },
  { name: 'الغاز', kind: 'bill', category: 'فواتير واشتراكات', dueDay: 10 },
  { name: 'كروت الموبايل', kind: 'bill', category: 'فواتير واشتراكات', dueDay: 1 },
]
// البنود اللي ليها حد شهري
export const LIMIT_CATS = ['أكل وبيت', 'مواصلات', 'شخصي', 'مدرسة وعيال', 'صحة', 'لبس', 'هدايا ومناسبات']

export async function seedBudget() {
  if (await getSetting('seededBudget', false)) return
  await db.transaction('rw', db.obligations, db.settings, async () => {
    if (await getSetting('seededBudget', false)) return
    const existing = await db.obligations.toArray()
    for (const o of BUDGET_DEFAULT_OBLIGATIONS) {
      if (existing.some((x) => x.name === o.name)) continue
      await db.obligations.add({ ...o, amount: 0, active: true })
    }
    await setSetting('seededBudget', true)
  })
}

// صرف كل بند في شهر معيّن
export function spendByCat(mk, txns) {
  const out = {}
  for (const t of txns) if (t.type === 'expense' && t.date?.startsWith(mk)) out[t.category || 'تانية'] = (out[t.category || 'تانية'] || 0) + (Number(t.amount) || 0)
  return out
}

// اقتراح حد لكل بند = متوسط آخر ٣ شهور كاملة فيها صرف (مقرّب لأقرب ١٠٠)
export function suggestLimits(txns, now = new Date()) {
  const months = []
  for (let i = 1; i <= 3; i++) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  const used = months.filter((m) => txns.some((t) => t.type === 'expense' && t.date?.startsWith(m)))
  // لو مفيش شهر كامل لسه، ناخد الشهر الحالي ونكمّله لآخر الشهر
  const cur = monthKey(now)
  const out = {}
  if (!used.length) {
    const s = spendByCat(cur, txns)
    const day = now.getDate()
    const dim = daysInMonth(now.getFullYear(), now.getMonth())
    if (day < 10) return { limits: {}, basis: 'none' }
    for (const [c, v] of Object.entries(s)) out[c] = Math.ceil(((v / day) * dim) / 100) * 100
    return { limits: out, basis: 'current' }
  }
  for (const m of used) for (const [c, v] of Object.entries(spendByCat(m, txns))) out[c] = (out[c] || 0) + v / used.length
  for (const c of Object.keys(out)) out[c] = Math.ceil(out[c] / 100) * 100
  return { limits: out, basis: `${used.length}` }
}

// ملخص الشهر: المتوقع يدخل، والثابت والفواتير، والحدود، والمفروض يفضل
export function budgetSummary({ mk, txns, obligations, limits, expectedIncome }) {
  const obls = obligationsFor(mk, obligations, txns)
  const oblTotal = obls.reduce((s, o) => s + (o.paid ? Number(o.paidTx.amount) || 0 : Number(o.amount) || 0), 0)
  const limitTotal = Object.values(limits || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  const spent = spendByCat(mk, txns)
  const flow = monthFlow(mk, txns)
  return {
    obls,
    oblTotal,
    limitTotal,
    spent,
    income: expectedIncome || flow.income,
    left: (expectedIncome || flow.income) - oblTotal - limitTotal,
    unsetObl: obls.filter((o) => !Number(o.amount) && !o.paid).length,
  }
}
