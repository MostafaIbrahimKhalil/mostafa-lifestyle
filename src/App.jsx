import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, requestPersistentStorage } from './db.js'
import { ASPECTS } from './aspects.js'
import Icon from './components/Icon.jsx'
import Home from './screens/Home.jsx'
import Sections from './screens/Sections.jsx'
import Settings from './screens/Settings.jsx'

const TABS = [
  { id: 'home', label: 'اليوم', icon: 'home' },
  { id: 'sections', label: 'الأقسام', icon: 'grid' },
  { id: 'settings', label: 'الإعدادات', icon: 'gear' },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const nameRow = useLiveQuery(() => db.settings.get('name'), [])
  const name = nameRow?.value ?? 'مصطفى'

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // يشيك على تحديث كل ساعة طول ما التطبيق مفتوح
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    requestPersistentStorage()
    setSetting('lastOpened', new Date().toISOString())
  }, [])

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-bar" role="status">
          <span>فيه تحديث جديد للتطبيق</span>
          <button className="btn btn-small" onClick={() => updateServiceWorker(true)}>
            حدّث دلوقتي
          </button>
        </div>
      )}

      <main className="screen" key={tab}>
        {tab === 'home' && <Home name={name} aspects={ASPECTS} onOpenSettings={() => setTab('settings')} />}
        {tab === 'sections' && <Sections aspects={ASPECTS} />}
        {tab === 'settings' && <Settings name={name} />}
      </main>

      <nav className="tabbar" aria-label="القوائم">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
