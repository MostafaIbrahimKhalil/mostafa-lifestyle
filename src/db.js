import Dexie from 'dexie'

// قاعدة البيانات على الموبايل نفسه (IndexedDB) — مفيش أي بيانات بتطلع برّه الجهاز.
// كل قسم جديد هيضيف جدول هنا في نسخة أعلى (db.version(2)...) من غير ما يمسح القديم.
export const db = new Dexie('mostafa-lifestyle')

db.version(1).stores({
  // إعدادات عامة: { key, value }
  settings: 'key',
  // سجل يومي عام لأي حاجة بتتعلّم ✓: { id, date: 'YYYY-MM-DD', type, value, createdAt }
  logs: '++id, date, type, [date+type]',
})

db.version(2).stores({
  // علامات ✓ اليومية: id = `${date}|${item}` — مثلًا '2026-10-18|prayer:fajr'
  // { id, date, item, value, at }
  checks: 'id, date, item',
  // المهام: kind = 'daily' (شغل ثابت كل يوم) | 'once' (حسب الظروف ليوم معيّن) | 'monthly'
  // { id, kind, title, priority (1 مهم جدًا، 2 مهم، 3 عادي), date, done, doneAt, dayOfMonth, active, createdAt }
  tasks: '++id, kind, date, done',
  // عدّاد التسبيح الحر: id = `${date}|${phrase}` — { id, date, phrase, count }
  tasbih: 'id, date',
  // الأهداف: { id, title, targetDate, note, done, order }
  goals: '++id, order',
})

db.version(3)
  .stores({
    // تمرين يوم: { id, date, routine, sets: { [exId]: [{w, r, done}] }, cardio: { kind, minutes, done }, done }
    workouts: '++id, date, routine',
    // وزن الجسم: { date, kg }
    body: 'date',
    // حفظ القرآن لكل سورة: { surah, status: 'memorized'|'learning'|'paused'|'todo', reached, priority, updatedAt }
    hifz: 'surah, status',
  })
  .upgrade(async (tx) => {
    // الأهداف بقت ليها حالة وأولوية
    await tx
      .table('goals')
      .toCollection()
      .modify((g) => {
        if (!g.status) g.status = g.done ? 'done' : 'active'
        if (!g.priority) g.priority = 2
      })
  })

db.version(4).stores({
  // العملاء: { id, name, kind: 'retainer'|'perVideo'|'perJob', rate, dueDay (0 = آخر الشهر), note, startMonth, active, order }
  clients: '++id, active',
  // الطلبات: { id, clientId, kind, title, qty, delivered, deliveries: [{date, n}], unitPrice, total,
  //   month ('YYYY-MM' للباقة), receivedDate, deadline, cancelled, createdAt }
  jobs: '++id, clientId, month',
  // الدفعات: { id, clientId, amount, date, jobId (اختياري), note }
  payments: '++id, clientId, date',
})

db.version(5).stores({
  // دروس الحفظ: { id (ترتيبه)، surah, from, to, startedAt, memorizedAt, steadyAt, reviews: [{date, ok}], interval, nextReview }
  hifzLessons: 'id, nextReview',
  // المحفظة
  // الحسابات: { id, name, type: 'cash'|'bank'|'wallet'|'gold', opening, order, active }
  accounts: '++id',
  // الحركات: { id, date, type: 'expense'|'income'|'transfer'|'adjust'|'toEnvelope'|'fromEnvelope',
  //   amount (جنيه، أو جرام في حساب الدهب), accountId, toAccountId, envelopeId, category, note, paymentId, obligationId, month }
  txns: '++id, date, accountId, envelopeId, obligationId, paymentId',
  // الأظرف: { id, name, target, kind: 'cash'|'gold', priority, order, active }
  envelopes: '++id',
  // الالتزامات الشهرية: { id, name, amount, dueDay, category, active }
  obligations: '++id',
  // مشتريات الشهر: { id, name, active, boughtMonths: ['YYYY-MM'] }
  shopping: '++id',
  // عليّا: { id, person, amount, date, note, paid: [{date, amount}], settled }
  debts: '++id',
})

db.version(6).stores({
  // جدول النشر: { id, date, title, hook, cta, edit, caption, edited, scheduled, published }
  posts: '++id, date',
  // مواعيد الدكاترة والتطعيمات: { id, kind: 'doctor'|'vaccine', title, date, place, note, done }
  appts: '++id, date',
  // مشتريات المولود: { id, name, price, beforeBirth, bought }
  babyItems: '++id',
})

// أهداف السنة المبدئية — بتتضاف مرة واحدة بس
export async function seedDefaults() {
  const seeded = await getSetting('seededGoals', false)
  if (seeded) return
  const count = await db.goals.count()
  if (count === 0) {
    await db.goals.bulkAdd([
      { title: 'شهادة Goethe للألماني', targetDate: '', note: '', done: false, status: 'active', priority: 2, steps: [], order: 1 },
      { title: 'شهادة IELTS للإنجليزي', targetDate: '', note: '', done: false, status: 'active', priority: 2, steps: [], order: 2 },
      { title: 'التقديم لمنحة DW', targetDate: '', note: '', done: false, status: 'active', priority: 2, steps: [], order: 3 },
    ])
  }
  await setSetting('seededGoals', true)
}

// ===== علامات ✓ =====

export function checkId(date, item) {
  return `${date}|${item}`
}

export async function setCheck(date, item, done, value = true) {
  const id = checkId(date, item)
  if (done) await db.checks.put({ id, date, item, value, at: new Date().toISOString() })
  else await db.checks.delete(id)
}

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

// ===== النسخة الاحتياطية =====

const BACKUP_APP = 'mostafa-lifestyle'

export async function exportBackup() {
  const tables = {}
  for (const table of db.tables) {
    tables[table.name] = await table.toArray()
  }
  return {
    app: BACKUP_APP,
    appVersion: __APP_VERSION__,
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

export async function importBackup(data) {
  if (!data || data.app !== BACKUP_APP || typeof data.tables !== 'object') {
    throw new Error('الملف ده مش نسخة احتياطية من التطبيق')
  }
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = data.tables[table.name]
      if (!Array.isArray(rows)) continue
      await table.clear()
      await table.bulkPut(rows)
    }
  })
}

// نطلب من المتصفح ما يمسحش البيانات لو المساحة قلّت
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted()
      if (!already) await navigator.storage.persist()
    }
  } catch {
    // مش مدعوم — مفيش مشكلة
  }
}
