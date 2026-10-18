import { useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { exportBackup, importBackup, setSetting } from '../db.js'
import { dateKey, num } from '../lib/dates.js'
import { getDeviceLocation } from '../lib/prayer.js'
import {
  isIOS,
  isStandalone,
  notificationStatus,
  requestNotifications,
  sendTestNotification,
} from '../lib/device.js'

export default function Settings({ settings }) {
  const [draftName, setDraftName] = useState(settings.name)
  const [locBusy, setLocBusy] = useState(false)
  const [notif, setNotif] = useState(notificationStatus())
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)
  const standalone = isStandalone()

  function flash(text, kind = 'ok') {
    setMsg({ text, kind })
    setTimeout(() => setMsg(null), 4000)
  }

  async function saveName(e) {
    e.preventDefault()
    const clean = draftName.trim()
    if (!clean) return
    await setSetting('name', clean)
    flash('اتحفظ الاسم')
  }

  async function updateLocation() {
    setLocBusy(true)
    try {
      await setSetting('location', await getDeviceLocation())
      flash('اتحدد مكانك، والمواقيت اتظبطت عليه')
    } catch (err) {
      flash(err.message, 'warn')
    }
    setLocBusy(false)
  }

  async function enableAndTest() {
    try {
      let status = notificationStatus()
      if (status === 'default') status = await requestNotifications()
      setNotif(status)
      if (status === 'granted') {
        await sendTestNotification()
        flash('بعتنالك إشعار تجربة')
      } else if (status === 'denied') {
        flash('الإشعارات مقفولة. افتحها من إعدادات الآيفون ← الإشعارات ← مصطفى لايف', 'warn')
      }
    } catch {
      flash('حصلت مشكلة في الإشعار، جرّب تاني', 'warn')
    }
  }

  async function doExport() {
    try {
      const data = await exportBackup()
      const json = JSON.stringify(data, null, 2)
      const filename = `mostafa-lifestyle-backup-${dateKey()}.json`
      const file = new File([json], filename, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'نسخة احتياطية — مصطفى لايف' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      await setSetting('lastBackup', new Date().toISOString())
      flash('النسخة الاحتياطية جاهزة')
    } catch (err) {
      if (err?.name !== 'AbortError') flash('ما قدرناش نعمل النسخة، جرّب تاني', 'warn')
    }
  }

  async function doImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('الملف ده هيحل محل كل البيانات اللي في التطبيق دلوقتي. نكمّل؟')) return
    try {
      const data = JSON.parse(await file.text())
      await importBackup(data)
      flash('رجّعنا البيانات من النسخة الاحتياطية')
    } catch (err) {
      flash(err?.message || 'الملف ده مش سليم', 'warn')
    }
  }

  async function checkUpdate() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
      flash(reg?.waiting ? 'فيه تحديث — دوس "حدّث دلوقتي" فوق' : 'إنت على آخر نسخة')
    } catch {
      flash('مش قادرين نشيك دلوقتي، اتأكد إن النت شغال', 'warn')
    }
  }

  const notifLabel = {
    granted: 'شغالة',
    denied: 'مقفولة',
    default: 'لسه ما اتفعّلتش',
    unsupported: standalone ? 'مش مدعومة على الجهاز ده' : 'ثبّت التطبيق الأول',
  }[notif]

  return (
    <>
      <header className="page-head">
        <h1>الإعدادات</h1>
      </header>

      {msg && <div className={`toast toast-${msg.kind}`}>{msg.text}</div>}

      <section className="card">
        <h2>اسمك</h2>
        <form className="row" onSubmit={saveName}>
          <input
            className="input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={30}
            aria-label="الاسم"
          />
          <button className="btn" type="submit">
            حفظ
          </button>
        </form>
      </section>

      <section className="card">
        <h2>مكانك</h2>
        <p className="muted">
          المواقيت بحساب الهيئة المصرية العامة للمساحة على: <strong>{settings.location?.label}</strong>
        </p>
        <button className="btn btn-ghost btn-wide" onClick={updateLocation} disabled={locBusy}>
          <Icon name="pin" size={20} />
          {locBusy ? 'بنحدد…' : 'حدّث مكاني'}
        </button>
      </section>

      <section className="card">
        <h2>يومك</h2>
        <label className="field field-row">
          <span>بنام الساعة</span>
          <input
            className="input input-small"
            type="time"
            value={settings.sleepTime}
            onChange={(e) => e.target.value && setSetting('sleepTime', e.target.value)}
          />
        </label>
        <p className="muted">أسنان الليل قبلها بربع ساعة، وأذكار النوم في معادها. اليوم بيتقفل الساعة ٣ الفجر.</p>
      </section>

      <section className="card">
        <h2>القرآن</h2>
        <label className="field field-row">
          <span>الجزء اللي عليه الدور</span>
          <select
            className="input input-small"
            value={settings.wirdNext}
            onChange={(e) => setSetting('wirdNext', Number(e.target.value))}
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <option key={j} value={j}>
                {num(j)}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-row">
          <span>بقرا الورد</span>
          <select
            className="input input-small"
            value={settings.wirdSlot}
            onChange={(e) => setSetting('wirdSlot', e.target.value)}
          >
            <option value="fajr">بعد الفجر</option>
            <option value="asr">بعد العصر</option>
            <option value="isha">بعد العشاء</option>
          </select>
        </label>
        <label className="field field-row">
          <span>حفظ ٣ آيات كل يوم</span>
          <input
            type="checkbox"
            className="switch"
            checked={settings.hifzEnabled !== false}
            onChange={(e) => setSetting('hifzEnabled', e.target.checked)}
          />
        </label>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>الإشعارات</h2>
          <span className={`pill ${notif === 'granted' ? 'pill-ok' : ''}`}>{notifLabel}</span>
        </div>
        {!standalone && isIOS() ? (
          <p className="muted">الإشعارات على الآيفون بتشتغل بس لما التطبيق يبقى متثبت على الشاشة الرئيسية.</p>
        ) : (
          <button className="btn btn-wide" onClick={enableAndTest} disabled={notif === 'unsupported'}>
            <Icon name="bell" size={20} />
            {notif === 'granted' ? 'ابعت إشعار تجربة' : 'شغّل الإشعارات وجرّبها'}
          </button>
        )}
      </section>

      <section className="card">
        <h2>النسخة الاحتياطية</h2>
        <p className="muted">
          بياناتك محفوظة على موبايلك بس. اعمل نسخة كل فترة واحفظها في Files أو ابعتها لنفسك، عشان لو الموبايل
          اتغيّر أو شلت الأيقونة.
        </p>
        <div className="row">
          <button className="btn" onClick={doExport}>
            <Icon name="download" size={20} />
            اعمل نسخة
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={20} />
            رجّع من نسخة
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>التطبيق</h2>
          <span className="pill">نسخة {__APP_VERSION__}</span>
        </div>
        <button className="btn btn-ghost btn-wide" onClick={checkUpdate}>
          <Icon name="refresh" size={20} />
          شيك على تحديث
        </button>
      </section>
    </>
  )
}
