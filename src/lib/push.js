// ربط التطبيق بسيرفر الإشعارات: الاشتراك، وإرسال جدول التذكيرات لأقرب يومين
import { db, getSetting, setSetting } from '../db.js'
import { addDays, dateKey, logicalDate, timeOnDay } from './dates.js'
import { DEFAULT_SLEEP } from './day.js'
import { PRAYERS, prayerTimesFor } from './prayer.js'
import { DEFAULT_GYM_TIME, routineFor } from './workout.js'
import { backupDue } from './backup.js'
import { lessonTitle, todayPlan } from './hifz.js'
import { obligationsFor } from './wallet.js'
import { isSunnahFastDay, waterPlan } from './water.js'

export const PUSH_URL = 'https://mostafa-push.ui-designer-mostafa-ibrahim.workers.dev'
const MIN = 60 * 1000

export const NOTIFY_DEFAULTS = {
  prayerBefore: true, // قبل الأذان بـ ١٠ دقايق
  prayerAt: true, // وقت الأذان
  adhkar: true,
  teeth: true,
  gym: true,
  wird: true,
  hifz: true,
  bills: true,
  water: true, // مواعيد كوبايات المية
  fast: true, // سؤال الصيام والسحور
  plan: true, // مواعيد الدكاترة والتطعيمات، وفيديو مش متجدول، ومهام الخطة المهمة
}

export function notifyPrefs(settings) {
  return { ...NOTIFY_DEFAULTS, ...(settings.notify || {}) }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function getSubscription(create) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub && create) {
    const { publicKey } = await fetch(`${PUSH_URL}/vapid`).then((r) => r.json())
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) })
  }
  return sub
}

// جدول التذكيرات من دلوقتي لحد آخر بكرة — من غير الحاجات اللي اتعملت النهارده
export async function buildSchedule(settings, now = new Date()) {
  const prefs = notifyPrefs(settings)
  const today = logicalDate(now)
  const doneToday = new Set(
    (await db.checks.where('date').equals(dateKey(today)).toArray()).map((c) => c.item),
  )
  const items = []
  const push = (at, title, body, tag, item, dayIdx) => {
    if (at <= now) return
    if (dayIdx === 0 && item && doneToday.has(item)) return
    items.push({ at: at.getTime(), title, body, tag })
  }

  for (let i = 0; i < 2; i++) {
    const day = addDays(today, i)
    const t = prayerTimesFor(day, settings.location || undefined)
    for (const p of PRAYERS) {
      if (prefs.prayerBefore)
        push(new Date(t[p.id].getTime() - 10 * MIN), `${p.name} بعد ١٠ دقايق`, 'جهّز نفسك للصلاة', `pre-${p.id}`, `prayer:${p.id}`, i)
      if (prefs.prayerAt) push(t[p.id], `حان وقت صلاة ${p.name}`, 'الصلاة خير من الدنيا وما فيها', `adhan-${p.id}`, `prayer:${p.id}`, i)
    }
    if (prefs.adhkar) {
      push(new Date(t.fajr.getTime() + 25 * MIN), 'أذكار الصباح', 'دقايق تبدأ بيها يومك', 'adhkar-morning', 'adhkar:morning', i)
      push(new Date(t.asr.getTime() + 15 * MIN), 'أذكار المساء', 'متنساش أذكار المساء', 'adhkar-evening', 'adhkar:evening', i)
    }
    const sleep = timeOnDay(day, settings.sleepTime || DEFAULT_SLEEP)
    if (prefs.teeth) push(new Date(sleep.getTime() - 15 * MIN), 'غسيل الأسنان', 'قبل النوم 🦷', 'teeth-pm', 'teeth:pm', i)
    if (prefs.teeth && day.getDay() === 4) push(timeOnDay(day, '21:00'), 'قص الضوافر', 'النهارده الخميس ✂️', 'nails', 'nails', i)
    if (prefs.adhkar) push(sleep, 'أذكار النوم', 'تصبح على خير', 'adhkar-sleep', 'adhkar:sleep', i)
    if (prefs.wird) {
      const slot = settings.wirdSlot || 'fajr'
      const at = { fajr: t.sunrise, asr: t.asr, isha: t.isha }[slot]
      push(new Date(at.getTime() + 20 * MIN), 'وردك النهارده', 'جزء في اليوم', 'wird', 'wird', i)
    }
    const routine = routineFor(day, settings)
    if (prefs.gym && routine && !routine.optional) {
      const at = timeOnDay(day, settings.gymTime || DEFAULT_GYM_TIME)
      push(new Date(at.getTime() - 30 * MIN), `${routine.name} بعد نص ساعة 💪`, 'جهّز هدومك ومية', 'gym', 'gym', i)
    }
  }
  // الحفظ: الجديد الصبح، والتسميع بعد العصر وقبل النوم، والمراجعة بعد العشا
  if (prefs.hifz && settings.hifzEnabled !== false) {
    const rows = await db.hifzLessons.toArray()
    const pace = settings.hifzPace || 'everyOther'
    const p = todayPlan(rows, pace, dateKey(today))
    const t = prayerTimesFor(today, settings.location || undefined)
    const sleep = timeOnDay(today, settings.sleepTime || DEFAULT_SLEEP)
    const l = p.lesson
    if (l && p.mode === 'new')
      push(new Date(t.sunrise.getTime() + 30 * MIN), 'حفظ النهارده', `${lessonTitle(l)}، ٣ آيات بس`, 'hifz-new', null, 0)
    if (l && p.mode === 'doneToday') {
      const done = new Set(l.sameDay || [])
      if (!done.has('r2')) push(new Date(t.asr.getTime() + 30 * MIN), 'سمّع حفظ النهارده', `${lessonTitle(l)}، ٣ مرات أو صلّي بيها`, 'hifz-r2', null, 0)
      if (!done.has('r3')) push(new Date(sleep.getTime() - 30 * MIN), 'تسميع قبل النوم', lessonTitle(l), 'hifz-r3', null, 0)
    }
    if (l && p.mode === 'steady')
      push(new Date(t.asr.getTime() + 30 * MIN), 'يوم تثبيت', `سمّع ${lessonTitle(l)} واربطها باللي قبلها`, 'hifz-steady', null, 0)
    if (p.due.length)
      push(new Date(t.isha.getTime() + 40 * MIN), 'تسميع المراجعة', `عليك ${p.due.length.toLocaleString('ar-EG')} تسميع النهارده`, 'hifz-review', null, 0)
    // بكرة: الجديد ولا التثبيت (بيتحدّث تاني لما تفتح التطبيق)
    const tomorrow = addDays(today, 1)
    const t1 = prayerTimesFor(tomorrow, settings.location || undefined)
    const tomorrowNew = !(pace === 'everyOther' && p.mode === 'doneToday')
    push(
      new Date(t1.sunrise.getTime() + 30 * MIN),
      tomorrowNew ? 'حفظ النهارده' : 'يوم تثبيت',
      tomorrowNew ? '٣ آيات جديدة' : 'سمّع اللي حفظته امبارح',
      'hifz-new',
      null,
      1,
    )
  }
  // الالتزامات: تذكير بالليل قبل معادها بيوم، ويوم المعاد الصبح
  if (prefs.bills) {
    const [obligations, txns] = await Promise.all([db.obligations.toArray(), db.txns.where('obligationId').above(0).toArray()])
    for (let i = 0; i < 2; i++) {
      const day = addDays(today, i)
      const next = addDays(day, 1)
      for (const k of [dateKey(day), dateKey(next)]) {
        for (const o of obligationsFor(k.slice(0, 7), obligations, txns)) {
          if (o.paid || o.due !== k) continue
          const isToday = k === dateKey(day)
          push(
            timeOnDay(day, isToday ? '10:00' : '20:00'),
            isToday ? `النهارده معاد ${o.name}` : `بكرة معاد ${o.name}`,
            `${Math.round(o.amount).toLocaleString('ar-EG')} جنيه`,
            `bill-${o.id}-${k}`,
            null,
            i,
          )
        }
      }
    }
  }
  // الخطة: مواعيد الدكاترة والتطعيمات، والفيديو اللي لسه ما اتجدولش، والمهام المهمة جدًا
  if (prefs.plan) {
    const t0 = dateKey(today)
    const t1 = dateKey(addDays(today, 1))
    const t2 = dateKey(addDays(today, 2))
    const [appts, posts, tasks] = await Promise.all([
      db.appts.where('date').between(t0, t2, true, true).toArray(),
      db.posts.where('date').between(t0, t2, true, true).toArray(),
      db.tasks.where('date').between(t0, t1, true, true).toArray(),
    ])
    for (let i = 0; i < 2; i++) {
      const day = addDays(today, i)
      const k = dateKey(day)
      const next = dateKey(addDays(day, 1))
      for (const a of appts.filter((x) => !x.done)) {
        if (a.date === k) push(timeOnDay(day, '09:00'), `النهارده: ${a.title}`, a.place || 'من البيت والمولود', `appt-${a.id}-0`, null, i)
        if (a.date === next) push(timeOnDay(day, '20:00'), `بكرة: ${a.title}`, a.place || 'جهّز نفسك', `appt-${a.id}-1`, null, i)
      }
      for (const p of posts.filter((x) => !x.scheduled && !x.published)) {
        if (p.date === next) push(timeOnDay(day, '20:00'), `فيديو بكرة لسه ما اتجدولش`, `${p.title}: ${p.hook || ''}`, `post-${p.id}`, null, i)
        if (p.date === k) push(timeOnDay(day, '10:00'), `فيديو النهارده: ${p.title}`, 'لسه ما اتجدولش — انشره أو جدوله', `post-${p.id}-0`, null, i)
      }
      // مهام ليها ساعة محددة (زي مشروع كلمات الألماني)
      for (const x of tasks.filter((x) => x.kind === 'once' && !x.done && x.date === k && x.at)) {
        push(new Date(timeOnDay(day, x.at).getTime() - 15 * MIN), 'بعد ربع ساعة', x.title, `task-${x.id}`, null, i)
      }
      const important = tasks.filter((x) => x.kind === 'once' && !x.done && x.priority === 1 && x.date === k)
      if (important.length)
        push(
          timeOnDay(day, '08:30'),
          important.length === 1 ? 'مهمة مهمة النهارده' : `${important.length.toLocaleString('ar-EG')} مهام مهمة النهارده`,
          important.map((x) => x.title).join('، ').slice(0, 120),
          `tasks-${k}`,
          null,
          i,
        )
    }
  }
  // المية والصيام
  if ((prefs.water || prefs.fast) && settings.foodEnabled !== false) {
    const k0 = dateKey(today)
    const k1 = dateKey(addDays(today, 1))
    const items = await db.checks.where('date').anyOf(k0, k1).toArray()
    const has = (k, item) => items.some((c) => c.date === k && c.item === item)
    const count = items.find((c) => c.date === k0 && c.item === 'water:count')?.value || 0
    for (let i = 0; i < 2; i++) {
      const day = addDays(today, i)
      const k = i ? k1 : k0
      const fasting = has(k, 'fast:yes')
      if (prefs.water) {
        waterPlan(day, settings, fasting).forEach((p, j) => {
          if (i === 0 && count >= p.sum) return
          push(p.at, `اشرب ${p.cups.toLocaleString('ar-EG')} ${p.cups === 1 ? 'كوباية' : 'كوبايات'} مية`, p.label, `water-${k}-${j}`, null, i)
        })
      }
      if (prefs.fast) {
        const t = prayerTimesFor(day, settings.location || undefined)
        if (fasting) {
          push(new Date(t.fajr.getTime() - 60 * MIN), 'السحور', 'تسحّروا فإن في السحور بركة — واشرب ٣ كوبايات', `suhoor-${k}`, null, i)
          push(t.maghrib, 'الفطار 🤍', 'ذهب الظمأ وابتلّت العروق وثبت الأجر إن شاء الله', `iftar-${k}`, null, i)
        }
        // بكرة اتنين أو خميس ولسه ما قررتش
        const next = addDays(day, 1)
        const nk = dateKey(next)
        if (i === 0 && isSunnahFastDay(next) && !has(nk, 'fast:yes') && !has(nk, 'fast:no')) {
          push(timeOnDay(day, '21:30'), `بكرة ${next.getDay() === 1 ? 'الاتنين' : 'الخميس'}: هتصوم؟`, 'افتح التطبيق وقرر، عشان المية والسحور يتظبطوا', `fast-ask-${nk}`, null, 0)
        }
      }
    }
  }
  // تذكير بالنسخة الاحتياطية الساعة ٩ بالليل لو مستحقة
  if (backupDue(settings, now)) {
    for (let i = 0; i < 2; i++) {
      const at = timeOnDay(addDays(today, i), '21:00')
      if (at > now) {
        items.push({ at: at.getTime(), title: 'نسخة احتياطية', body: 'افتح التطبيق واعمل نسخة احتياطية لبياناتك 🔒', tag: 'backup' })
        break
      }
    }
  }
  return items.sort((a, b) => a.at - b.at)
}

// اشتراك أول مرة (لازم يبقى بعد ضغطة من المستخدم على الآيفون)
export async function enablePush(settings) {
  if (!pushSupported()) throw new Error('الإشعارات مش مدعومة هنا. اتأكد إن التطبيق متثبت على الشاشة الرئيسية')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('الإشعارات مقفولة. افتحها من إعدادات الآيفون ← الإشعارات ← مصطفى لايف')
  const sub = await getSubscription(true)
  await sync(settings, sub)
  await setSetting('pushEnabled', true)
  const r = await fetch(`${PUSH_URL}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  }).then((x) => x.json())
  if (!r.ok) throw new Error(`السيرفر ما قدرش يبعت (${r.status || r.error})`)
  return true
}

// بيتنادي كل ما التطبيق يتفتح أو يتقفل: يحدّث الجدول عند السيرفر
export async function sync(settings, existing = null) {
  if (!pushSupported() || Notification.permission !== 'granted') return null
  const sub = existing || (await getSubscription(false))
  if (!sub) return null
  const schedule = await buildSchedule(settings)
  const res = await fetch(`${PUSH_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), schedule }),
    keepalive: true,
  }).then((r) => r.json())
  await setSetting('pushLastSync', new Date().toISOString())
  return res
}

export async function pushEnabled() {
  return (await getSetting('pushEnabled', false)) && pushSupported() && Notification.permission === 'granted'
}
