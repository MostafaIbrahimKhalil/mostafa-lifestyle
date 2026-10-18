import { useEffect, useState } from 'react'
import BalanceRing from '../components/BalanceRing.jsx'
import Icon from '../components/Icon.jsx'
import { formatGregorian, formatHijri, greeting } from '../lib/dates.js'
import { isIOS, isStandalone, notificationStatus } from '../lib/device.js'

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Home({ name, aspects, onOpenSettings }) {
  const now = useNow()
  const standalone = isStandalone()
  const showInstall = !standalone
  const notif = notificationStatus()
  const showNotifHint = standalone && notif === 'default'

  // لسه مفيش أقسام شغالة، فكل الأقواس فاضية
  const progress = {}

  return (
    <>
      <header className="hero">
        <p className="eyebrow">{greeting(now)}</p>
        <h1>{name}</h1>
        <p className="dates">
          <span>{formatGregorian(now)}</span>
          <span className="dot" aria-hidden="true">·</span>
          <span>{formatHijri(now)}</span>
        </p>
      </header>

      {showInstall && <InstallCard ios={isIOS()} />}

      {showNotifHint && (
        <button className="card card-action" onClick={onOpenSettings}>
          <span className="card-icon">
            <Icon name="bell" />
          </span>
          <span>
            <strong>شغّل الإشعارات</strong>
            <small>عشان التذكيرات توصلك في وقتها</small>
          </span>
        </button>
      )}

      <section className="card balance">
        <div className="balance-head">
          <h2>ميزان اليوم</h2>
          <span className="pill">قريبًا</span>
        </div>
        <BalanceRing aspects={aspects} progress={progress} centerValue="٠٪" centerLabel="النهارده" />
        <ul className="legend">
          {aspects.map((a) => (
            <li key={a.id}>
              <span className="swatch" style={{ background: a.color }} />
              {a.name}
            </li>
          ))}
        </ul>
        <p className="muted center">الدائرة هتتملى لوحدها لما الأقسام تشتغل، قسم ورا التاني.</p>
      </section>
    </>
  )
}

function InstallCard({ ios }) {
  return (
    <section className="card install">
      <h2>ثبّت التطبيق على موبايلك</h2>
      {ios ? (
        <ol className="steps">
          <li>
            دوس زرار المشاركة <Icon name="share" size={18} /> تحت في Safari
          </li>
          <li>
            اختار <strong>إضافة إلى الشاشة الرئيسية</strong> <Icon name="plusSquare" size={18} />
          </li>
          <li>
            سمّيه <strong>مصطفى لايف</strong> ودوس <strong>إضافة</strong>
          </li>
          <li>افتحه من الأيقونة الجديدة، مش من Safari</li>
        </ol>
      ) : (
        <p className="muted">افتح قائمة المتصفح واختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".</p>
      )}
    </section>
  )
}
