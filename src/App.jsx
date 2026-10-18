import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { getSetting, requestPersistentStorage, seedDefaults, setSetting } from './db.js'
import { ASPECTS } from './aspects.js'
import { useSettings } from './hooks.js'
import { todayKey } from './lib/dates.js'
import { sync } from './lib/push.js'
import { seedWallet } from './lib/wallet.js'
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
import Work from './screens/Work.jsx'
import Wallet from './screens/Wallet.jsx'
import Plan from './screens/Plan.jsx'
import Posts from './screens/Posts.jsx'
import Baby from './screens/Baby.jsx'
import { seedPlan } from './lib/plan.js'
import { gymEveryDay } from './lib/reminders.js'

const TABS = [
  { id: 'today', label: 'اليوم', icon: 'home' },
  { id: 'tasks', label: 'المهام', icon: 'list' },
  { id: 'progress', label: 'تقدّمي', icon: 'chart' },
  { id: 'wallet', label: 'المحفظة', icon: 'wallet' },
  { id: 'more', label: 'المزيد', icon: 'more' },
]

export default function App() {
  const [tab, setTab] = useState('today')
  const [sub, setSub] = useState(null) // صفحة جوه "المزيد"
  const [subBack, setSubBack] = useState(null) // لو الصفحة اتفتحت من صفحة تانية
  const settings = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // يشيك على تحديث أول ما التطبيق يتفتح، ولما يرجع من الخلفية، وكل ساعة
      reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  // التحديث بيتطبّق لوحده لو التطبيق لسه مفتوح من أقل من دقيقة (يعني لسه فاتحه)
  const openedAt = useRef(Date.now())
  useEffect(() => {
    if (needRefresh && Date.now() - openedAt.current < 60 * 1000) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    requestPersistentStorage()
    seedDefaults()
    seedWallet()
    seedPlan()
    gymEveryDay()
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

  function openSub(id, from = null) {
    setSub(id)
    setSubBack(from)
    window.scrollTo({ top: 0 })
  }

  function openFromAnywhere(id) {
    setTab('more')
    openSub(id)
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
              onOpenSub={openFromAnywhere}
            />}
          {tab === 'tasks' && <Tasks />}
          {tab === 'progress' && (
            <Progress settings={settings} onOpenHifz={openHifz} onOpenWork={() => (setTab('more'), setSub('work'))} />
          )}
          {tab === 'wallet' && <Wallet settings={settings} onOpenWork={() => (setTab('more'), setSub('work'))} />}
          {tab === 'more' && sub && (
            <button className="back-btn" onClick={() => (subBack ? openSub(subBack) : setSub(null))}>
              <Icon name="chevronRight" size={18} /> {subBack === 'plan' ? 'خطتي' : 'المزيد'}
            </button>
          )}
          {tab === 'more' && !sub && <More onOpen={openSub} />}
          {tab === 'more' && sub === 'month' && <Month settings={settings} />}
          {tab === 'more' && sub === 'year' && <Year settings={settings} />}
          {tab === 'more' && sub === 'settings' && <Settings settings={settings} />}
          {tab === 'more' && sub === 'hifz' && <Hifz settings={settings} />}
          {tab === 'more' && sub === 'gym' && <GymPlan settings={settings} />}
          {tab === 'more' && sub === 'work' && <Work />}
          {tab === 'more' && sub === 'tasbih' && <Tasbih settings={settings} />}
          {tab === 'more' && sub === 'plan' && <Plan onOpen={(id) => openSub(id, 'plan')} />}
          {tab === 'more' && sub === 'posts' && <Posts />}
          {tab === 'more' && sub === 'baby' && <Baby />}
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
