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
