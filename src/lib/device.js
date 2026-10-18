// معلومات عن الجهاز وطريقة فتح التطبيق

export function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

// هل التطبيق مفتوح من أيقونة الشاشة الرئيسية (مش من Safari)؟
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function notificationStatus() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestNotifications() {
  if (notificationStatus() === 'unsupported') return 'unsupported'
  return Notification.requestPermission()
}

export async function sendTestNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('مصطفى لايف', {
    body: 'الإشعارات شغالة تمام ✓',
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icon-192.png`,
    lang: 'ar',
    dir: 'rtl',
    tag: 'test',
  })
}
