import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db.js'
import { DEFAULT_LOCATION } from './lib/prayer.js'
import { DEFAULT_SLEEP } from './lib/day.js'

export const SETTING_DEFAULTS = {
  name: 'مصطفى',
  location: DEFAULT_LOCATION,
  sleepTime: DEFAULT_SLEEP,
  wirdSlot: 'fajr',
  wirdNext: 1,
  hifzEnabled: true,
}

// كل الإعدادات كـ object واحد، وبتتحدّث لوحدها لما أي إعداد يتغيّر
export function useSettings() {
  const rows = useLiveQuery(() => db.settings.toArray(), [])
  if (!rows) return null
  const s = { ...SETTING_DEFAULTS }
  for (const r of rows) s[r.key] = r.value
  return s
}

// الوقت الحالي، بيتحدّث كل ٣٠ ثانية
export function useNow(intervalMs = 30 * 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}
