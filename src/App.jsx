import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { getSetting, requestPersistentStorage, seedDefaults, setSetting } from './db.js'
import { ASPECTS } from './aspects.js'
import { useSettings } from './hooks.js'
import { todayKey } from './lib/dates.js'
import { sync } from './lib/push.js'
import Icon from './components/Icon.jsx'
import Today from './screens/Today.jsx'
import Tasks from './screens/Tasks.jsx'
import Progress from './screens/Progress.jsx'
import More from './screens/More.jsx'
import Month from './screens/Month.jsx'
import Year from './screens/Year.jsx'
import Tasbih from './screens/Tasbih.jsx'
import Settings from './screens/Settings.jsx'
import Hifz from './screens/Hifz.jsx'
import GymPlan from './screens/GymPlan.jsx'

const TABS = [
  { id: 'today', label: 'اليوم', icon: 'home' },
  { id: 'tasks', label: 'المهام', icon: 'list' },
  { id: 'progress', label: 'تقدّمي', icon: 'chart' },
  { id: 'tasbih', label: 'التسبيح', icon: 'beads' },
  { id: 'more', label: 'المزيد', icon: 'more' },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [sub, setSub] = useState(null) // صفحة جوه "المزيد"
  const settings = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

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

  // نحدّث جدول الإشعارات عند السيرفر لما التطبيق يتفتح ولما يتقفل
  const synced = useRef(false)
  useEffect(() => {
    if (settings && !synced.current) {
      synced.current = true
      sync(settings).catch(() => {})
    }
  }, [settings])
  useEffect(() => {
    const onVis = () => {
      if (!settingsRef.current) return
      if (document.visibilityState === 'hidden' || document.visibilityState === 'visible') sync(settingsRef.current).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  function switchTab(id) {
    setTab(id)
    setSub(null)
    window.scrollTo({ top: 0 })
  }

  function openHifz() {
    setTab('more')
    setSub('hifz')
    window.scrollTo({ top: 0 })
  }

  function openSub(id) {
    setSub(id)
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
        <main className="screen" key={`${tab}-${sub}`}>
          {tab === 'today' && <Today
              settings={settings}
              aspects={ASPECTS}
              onOpenTasks={() => switchTab('tasks')}
              onOpenHifz={openHifz}
            />}
          {tab === 'tasks' && <Tasks />}
          {tab === 'progress' && <Progress settings={settings} onOpenHifz={openHifz} />}
          {tab === 'tasbih' && <Tasbih settings={settings} />}
          {tab === 'more' && sub && (
            <button className="back-btn" onClick={() => setSub(null)}>
              <Icon name="chevronRight" size={18} /> المزيد
            </button>
          )}
          {tab === 'more' && !sub && <More onOpen={openSub} />}
          {tab === 'more' && sub === 'month' && <Month settings={settings} />}
          {tab === 'more' && sub === 'year' && <Year settings={settings} />}
          {tab === 'more' && sub === 'settings' && <Settings settings={settings} />}
          {tab === 'more' && sub === 'hifz' && <Hifz />}
          {tab === 'more' && sub === 'gym' && <GymPlan settings={settings} />}
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
