import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { getSetting, requestPersistentStorage, seedDefaults, setSetting } from './db.js'
import { ASPECTS } from './aspects.js'
import { useSettings } from './hooks.js'
import { todayKey } from './lib/dates.js'
import Icon from './components/Icon.jsx'
import Today from './screens/Today.jsx'
import Month from './screens/Month.jsx'
import Year from './screens/Year.jsx'
import Tasbih from './screens/Tasbih.jsx'
import Settings from './screens/Settings.jsx'

const TABS = [
  { id: 'today', label: 'اليوم', icon: 'home' },
  { id: 'month', label: 'الشهر', icon: 'month' },
  { id: 'year', label: 'السنة', icon: 'star' },
  { id: 'tasbih', label: 'التسبيح', icon: 'beads' },
  { id: 'settings', label: 'الإعدادات', icon: 'gear' },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const settings = useSettings()

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
    seedDefaults()
    ;(async () => {
      if (!(await getSetting('firstUse'))) await setSetting('firstUse', todayKey())
      await setSetting('lastOpened', new Date().toISOString())
    })()
  }, [])

  function switchTab(id) {
    setTab(id)
    window.scrollTo({ top: 0 })
  }

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

      {settings && (
        <main className="screen" key={tab}>
          {tab === 'today' && <Today settings={settings} aspects={ASPECTS} />}
          {tab === 'month' && <Month settings={settings} />}
          {tab === 'year' && <Year settings={settings} />}
          {tab === 'tasbih' && <Tasbih settings={settings} />}
          {tab === 'settings' && <Settings settings={settings} />}
        </main>
      )}

      <nav className="tabbar" aria-label="القوائم">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => switchTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
