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
