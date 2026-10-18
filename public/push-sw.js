// بيتضاف للـ service worker: استقبال الإشعارات من السيرفر وفتح التطبيق لما تدوس عليها
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  const base = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'مصطفى لايف', {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: base + 'icon-192.png',
      badge: base + 'icon-192.png',
      lang: 'ar',
      dir: 'rtl',
      data: { url: data.url || base },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow(url)
    }),
  )
})
