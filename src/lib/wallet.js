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
