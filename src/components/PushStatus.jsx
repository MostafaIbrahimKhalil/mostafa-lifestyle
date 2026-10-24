// حالة الإشعارات: عشان تعرف المشكلة فين لو مش بيوصلك حاجة
import { useEffect, useState } from 'react'
import { formatShortDate, formatTime, num } from '../lib/dates.js'
import { pushSupported, serverStatus } from '../lib/push.js'
import { isIOS } from '../lib/device.js'

function ago(iso) {
  if (!iso) return null
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'دلوقتي'
  if (m < 60) return `من ${num(m)} دقيقة`
  if (m < 60 * 24) return `من ${num(Math.round(m / 60))} ساعة`
  return `من ${num(Math.round(m / 1440))} يوم`
}

export default function PushStatus({ settings, notif, standalone, busy, onRepair }) {
  const [hasSub, setHasSub] = useState(null)
  useEffect(() => {
    if (!pushSupported()) return setHasSub(false)
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setHasSub(!!s))
      .catch(() => setHasSub(false))
  }, [notif, settings.pushLastSync])

  const [server, setServer] = useState(null)
  useEffect(() => {
    serverStatus(settings.pushId)
      .then(setServer)
      .catch(() => setServer({ error: true }))
  }, [settings.pushId, settings.pushLastSync])

  const syncAge = settings.pushLastSync ? (Date.now() - new Date(settings.pushLastSync).getTime()) / 3600000 : null
  const rows = [
    isIOS() && { ok: standalone, text: standalone ? 'مفتوح من الشاشة الرئيسية' : 'لازم تفتحه من الأيقونة اللي على الشاشة الرئيسية' },
    { ok: notif === 'granted', text: notif === 'granted' ? 'الآيفون سامح بالإشعارات' : notif === 'denied' ? 'الإشعارات مقفولة من إعدادات الآيفون' : 'لسه ما سمحتش بالإشعارات' },
    { ok: !!hasSub, text: hasSub ? 'مشترك في سيرفر الإشعارات' : hasSub === null ? 'بنشوف الاشتراك…' : 'مش مشترك في السيرفر' },
    {
      ok: syncAge !== null && syncAge < 26 && !settings.pushLastError,
      text: settings.pushLastSync
        ? `آخر تحديث لمواعيد الإشعارات ${ago(settings.pushLastSync)}${settings.pushScheduled ? ` (${num(settings.pushScheduled)} إشعار جاي)` : ''}`
        : 'مواعيد الإشعارات لسه ما اتبعتتش للسيرفر',
    },
    server && !server.error && {
      ok: server.found,
      text: server.found ? `السيرفر عنده اشتراكك و${num(server.scheduled)} إشعار جاي` : 'السيرفر مش لاقي اشتراكك',
    },
    server?.last && {
      ok: server.last.status >= 200 && server.last.status < 300,
      text: `آخر إشعار اتبعت ${ago(new Date(server.last.at).toISOString())} (${server.last.title}): ${
        server.last.status < 300 ? 'وصل لسيرفر آبل ✓' : server.last.status === 410 || server.last.status === 404 ? 'الاشتراك اتلغى من الآيفون' : `آبل رفضه (${server.last.status})`
      }`,
    },
  ].filter(Boolean)
  const next = settings.pushNext && settings.pushNext.at > Date.now() ? settings.pushNext : null
  const broken = rows.some((r) => !r.ok) || settings.pushLastError

  return (
    <div className="push-status">
      <ul>
        {rows.map((r) => (
          <li key={r.text} className={r.ok ? 'ok' : 'bad'}>
            <span>{r.ok ? '✓' : '✗'}</span> {r.text}
          </li>
        ))}
      </ul>
      {next && (
        <p className="muted small">
          الإشعار الجاي: {next.title} — {formatShortDate(new Date(next.at))} {formatTime(new Date(next.at))}
        </p>
      )}
      {settings.pushLastError && <p className="late small">{settings.pushLastError}</p>}
      {notif === 'granted' && (
        <button className={`btn ${broken ? '' : 'btn-ghost'} btn-wide`} onClick={onRepair} disabled={busy}>
          صلّح الإشعارات (اشتراك جديد + إشعار تجربة)
        </button>
      )}
      {notif === 'denied' && (
        <p className="muted small">افتح إعدادات الآيفون ← الإشعارات ← مصطفى لايف ← Allow Notifications، وبعدين ارجع هنا.</p>
      )}
    </div>
  )
}
