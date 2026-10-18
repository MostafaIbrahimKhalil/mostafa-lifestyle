import { exportBackup, setSetting } from '../db.js'
import { addDays, dateKey, fromKey, todayKey } from './dates.js'

export const BACKUP_EVERY_DAYS = 7

// النسخة مستحقة لو فات أسبوع، أو لو عمرك ما عملت نسخة وبقالك ٣ أيام بتستخدم التطبيق
export function backupDue(settings, now = new Date()) {
  const today = todayKey(now)
  if (settings.lastBackup) {
    return dateKey(new Date(settings.lastBackup)) <= dateKey(addDays(fromKey(today), -BACKUP_EVERY_DAYS))
  }
  return !!settings.firstUse && settings.firstUse <= dateKey(addDays(fromKey(today), -3))
}

// بيعمل ملف النسخة ويفتح قايمة المشاركة على الآيفون (احفظ في Files أو ابعته لنفسك)
export async function shareBackup() {
  const data = await exportBackup()
  const json = JSON.stringify(data, null, 2)
  const filename = `mostafa-lifestyle-backup-${todayKey()}.json`
  const file = new File([json], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'نسخة احتياطية — مصطفى لايف' })
  } else {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  await setSetting('lastBackup', new Date().toISOString())
}
