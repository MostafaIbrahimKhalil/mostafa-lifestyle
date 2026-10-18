import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db } from '../db.js'
import { formatShortDate, fromKey, monthKey, num, todayKey } from '../lib/dates.js'
import {
  CLIENT_KINDS,
  INCOME_GOAL,
  clientLedger,
  deadlineInfo,
  deliver,
  ensureRetainerJobs,
  jobStatus,
  lastMonths,
  money,
  monthLabel,
  monthStats,
  payStatus,
  seedClients,
} from '../lib/work.js'

const PAY_LABEL = {
  paid: ['اتحاسبت ✓', 'st-formed'],
  partpaid: ['اتحاسبت على جزء', 'st-building'],
  unpaid: ['لسه ما اتحاسبتش', 'st-slipped'],
  nothing: ['لسه ما سلّمتش', 'st-new'],
  notdue: ['لسه معادها ما جاش', 'st-new'],
}

export default function Work() {
  const today = todayKey()
  const [ready, setReady] = useState(false)
  const [mk, setMk] = useState(monthKey(new Date()))
  const [view, setView] = useState(null) // { client } | { form: 'job'|'payment'|'client', ... }

  useEffect(() => {
    ;(async () => {
      await seedClients()
      await ensureRetainerJobs()
      setReady(true)
    })()
  }, [])

  const clients = useLiveQuery(() => db.clients.orderBy('id').toArray(), [])
  const jobs = useLiveQuery(() => db.jobs.toArray(), [])
  const payments = useLiveQuery(() => db.payments.toArray(), [])

  const data = useMemo(() => {
    if (!clients || !jobs || !payments) return null
    const active = clients.filter((c) => c.active !== false).sort((a, b) => (a.order || 99) - (b.order || 99))
    const ledgers = Object.fromEntries(clients.map((c) => [c.id, clientLedger(c, jobs, payments, today)]))
    return { active, ledgers, byId: Object.fromEntries(clients.map((c) => [c.id, c])) }
  }, [clients, jobs, payments, today])

  if (!ready || !data) return null
  const { active, ledgers, byId } = data
  const stats = monthStats(mk, clients, jobs, payments)
  const totalOwed = Object.values(ledgers).reduce((s, l) => s + l.owed, 0)
  const totalDue = Object.values(ledgers).reduce((s, l) => s + l.dueOwed, 0)

  if (view?.client) {
    return (
      <ClientView
        client={byId[view.client]}
        ledger={ledgers[view.client]}
        today={today}
        onBack={() => setView(null)}
        onForm={(f) => setView({ ...f, back: view.client })}
      />
    )
  }
  if (view?.form === 'job')
    return <JobForm clients={active} clientId={view.clientId} today={today} onDone={() => setView(view.back ? { client: view.back } : null)} />
  if (view?.form === 'payment')
    return (
      <PaymentForm
        clients={active}
        clientId={view.clientId}
        jobs={jobs}
        today={today}
        onDone={() => setView(view.back ? { client: view.back } : null)}
      />
    )
  if (view?.form === 'client')
    return <ClientForm client={view.edit} onDone={() => setView(view.back ? { client: view.back } : null)} />

  // المطلوب مني: الطلبات المفتوحة بالأقرب معادًا
  const open = jobs
    .filter((j) => !j.cancelled && j.kind !== 'retainer' && byId[j.clientId]?.active !== false)
    .filter((j) => jobStatus(j) === 'todo' || jobStatus(j) === 'partial')
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.id - b.id)

  const owedList = Object.values(ledgers)
    .filter((l) => l.owed > 0.5)
    .sort((a, b) => b.dueOwed - a.dueOwed || b.owed - a.owed)

  const months = lastMonths(6)
  const monthly = months.map((m) => ({ m, ...monthStats(m, clients, jobs, payments) }))
  const maxM = Math.max(INCOME_GOAL, ...monthly.map((x) => x.earned))

  const go = (delta) => {
    const [y, m] = mk.split('-').map(Number)
    setMk(monthKey(new Date(y, m - 1 + delta, 1)))
  }

  return (
    <>
      <header className="page-head month-head">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="الشهر اللي فات">
          <Icon name="chevronRight" />
        </button>
        <h1>{monthLabel(mk)}</h1>
        <button className="icon-btn" onClick={() => go(1)} aria-label="الشهر الجاي" disabled={mk >= monthKey(new Date())}>
          <Icon name="chevronLeft" />
        </button>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong>{num(stats.videos)}</strong>
          <span>فيديو اتسلّم</span>
        </div>
        <div className="stat">
          <strong className="money">{money(stats.earned)}</strong>
          <span>استحقيت</span>
        </div>
        <div className="stat">
          <strong className="money">{money(stats.received)}</strong>
          <span>استلمت</span>
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={() => setView({ form: 'job' })}>
          <Icon name="plus" size={18} />
          طلب شغل
        </button>
        <button className="btn btn-ghost" onClick={() => setView({ form: 'payment' })}>
          <Icon name="wallet" size={18} />
          وصلتني فلوس
        </button>
      </div>

      <section className="card owed-card">
        <div className="row-between">
          <h2>عند مين فلوس</h2>
          <span className="big-pct money">{money(totalOwed)}</span>
        </div>
        {totalDue > 0 && totalDue < totalOwed - 0.5 && (
          <p className="muted">منها {money(totalDue)} معادها جه، والباقي لسه معاده ما جاش.</p>
        )}
        {owedList.length === 0 ? (
          <p className="muted">مفيش فلوس ليك عند حد ✓</p>
        ) : (
          <ul className="totals">
            {owedList.map((l) => (
              <li key={l.client.id}>
                <button className="link-row row-between" onClick={() => setView({ client: l.client.id })}>
                  <span className="tl-text">
                    <strong>{l.client.name}</strong>
                    <small>
                      {l.dueOwed > 0.5
                        ? l.lateDays > 0
                          ? `متأخر ${num(l.lateDays)} يوم`
                          : 'معاده النهارده'
                        : 'لسه معاده ما جاش'}
                    </small>
                  </span>
                  <strong className="money">{money(l.owed)}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>المطلوب مني</h2>
          <span className="pill">{num(open.reduce((s, j) => s + Math.max(0, (j.qty || 0) - (j.delivered || 0)), 0))} فيديو فاضل</span>
        </div>
        {open.length === 0 ? (
          <p className="muted">مفيش شغل مستني. ضيف أي طلب يجيلك من "طلب شغل".</p>
        ) : (
          <ul className="jobs">
            {open.map((j) => (
              <JobRow key={j.id} job={j} client={byId[j.clientId]} ledger={ledgers[j.clientId]} today={today} showClient />
            ))}
          </ul>
        )}
      </section>

      {stats.perClient.length > 0 && (
        <section className="card">
          <h2>الشهر ده بالعميل</h2>
          <ul className="totals">
            {stats.perClient.map((r) => (
              <li key={r.client.id}>
                <button className="link-row row-between" onClick={() => setView({ client: r.client.id })}>
                  <span className="tl-text">
                    <strong>{r.client.name}</strong>
                    <small>
                      {r.client.kind === 'retainer'
                        ? `راتب الشهر${r.videos ? `، ${num(r.videos)} فيديو` : ''}`
                        : `${num(r.videos)} فيديو`}
                      {r.received ? `، استلمت ${money(r.received)}` : ''}
                    </small>
                  </span>
                  <strong className="money">{money(r.earned)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="row-between">
          <h2>الدخل بالشهور</h2>
          <span className="pill">الهدف {money(INCOME_GOAL)}</span>
        </div>
        <div className="income-bars">
          {monthly.map((x) => (
            <div key={x.m} className={`ib ${x.m === mk ? 'is-sel' : ''}`}>
              <small className="ib-val">{x.earned ? num(Math.round(x.earned / 1000)) + 'k' : ''}</small>
              <span className="ib-track">
                <span className="ib-goal" style={{ bottom: `${(INCOME_GOAL / maxM) * 100}%` }} />
                <span className="ib-earned" style={{ height: `${(x.earned / maxM) * 100}%` }} />
                <span className="ib-received" style={{ height: `${(x.received / maxM) * 100}%` }} />
              </span>
              <small>{new Intl.DateTimeFormat('ar-EG', { month: 'short' }).format(fromKey(`${x.m}-01`))}</small>
            </div>
          ))}
        </div>
        <div className="cal-legend">
          <span className="lg lg-earned" /> استحقيت
          <span className="lg lg-received" /> استلمت
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>العملاء</h2>
          <button className="link-btn" onClick={() => setView({ form: 'client' })}>
            + عميل
          </button>
        </div>
        <ul className="totals">
          {active.map((c) => (
            <li key={c.id}>
              <button className="link-row row-between" onClick={() => setView({ client: c.id })}>
                <span className="tl-text">
                  <strong>{c.name}</strong>
                  <small>
                    {CLIENT_KINDS[c.kind]}، {money(c.rate)}
                    {c.kind === 'perVideo' ? ' للفيديو' : c.kind === 'retainer' ? ' في الشهر' : ''}
                  </small>
                </span>
                <Icon name="chevronLeft" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function JobRow({ job, client, ledger, today, showClient }) {
  const st = jobStatus(job)
  const ps = payStatus(job, ledger?.perJob[job.id])
  const dl = deadlineInfo(job, today)
  const row = ledger?.perJob[job.id] || { earned: 0, paid: 0 }
  const remaining = job.qty ? Math.max(0, job.qty - (job.delivered || 0)) : null

  return (
    <li className={`job ${st === 'delivered' ? 'is-done' : ''}`}>
      <div className="row-between">
        <span className="tl-text">
          <strong>
            {showClient ? `${client?.name}، ` : ''}
            {job.title || (job.kind === 'retainer' ? 'راتب الشهر' : 'شغلانة')}
          </strong>
          <small>
            {job.kind === 'retainer'
              ? `${monthLabel(job.month)}، ${num(job.delivered || 0)} فيديو اتعمل`
              : `سلّمت ${num(job.delivered || 0)} من ${num(job.qty || 0)}${remaining ? `، فاضل ${num(remaining)}` : ''}`}
            {dl && st !== 'delivered' && (
              <span className={dl.late ? 'late' : ''}>
                {'، '}
                {dl.late ? `متأخر ${num(-dl.days)} يوم` : dl.days === 0 ? 'معاده النهارده' : `باقي ${num(dl.days)} يوم`}
              </span>
            )}
          </small>
        </span>
        <span className={`pill ${PAY_LABEL[ps][1]}`}>{PAY_LABEL[ps][0]}</span>
      </div>
      {job.qty > 0 && (
        <span className="bar bar-thin">
          <span style={{ width: `${Math.min(1, (job.delivered || 0) / job.qty) * 100}%` }} />
        </span>
      )}
      <div className="job-foot">
        {row.earned > 0 && (
          <small className="muted">
            {money(row.paid)} من {money(row.earned)}
          </small>
        )}
        <span className="job-actions">
          {(job.delivered || 0) > 0 && (
            <button className="mini" onClick={() => deliver(job, -1, today)} aria-label="شيل فيديو">
              −١
            </button>
          )}
          {(st !== 'delivered' || job.kind === 'retainer') && (
            <button className="open-btn" onClick={() => deliver(job, 1, today)}>
              سلّمت +١
            </button>
          )}
        </span>
      </div>
    </li>
  )
}

function ClientView({ client, ledger, today, onBack, onForm }) {
  const [showDone, setShowDone] = useState(false)
  const jobs = [...ledger.jobs].sort((a, b) => (b.month || b.receivedDate || '').localeCompare(a.month || a.receivedDate || '') || b.id - a.id)
  const open = jobs.filter((j) => ['todo', 'partial', 'retainer'].includes(jobStatus(j)) && !(j.kind === 'retainer' && payStatus(j, ledger.perJob[j.id]) === 'paid'))
  const done = jobs.filter((j) => !open.includes(j))
  const pays = [...ledger.payments].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <button className="back-btn" onClick={onBack}>
        <Icon name="chevronRight" size={18} /> الحسابات
      </button>
      <header className="page-head">
        <div className="row-between">
          <h1>{client.name}</h1>
          <button className="link-btn" onClick={() => onForm({ form: 'client', edit: client })}>
            تعديل
          </button>
        </div>
        <p className="muted">
          {CLIENT_KINDS[client.kind]}، {money(client.rate)}
          {client.note ? `، ${client.note}` : ''}
        </p>
      </header>

      <div className="stat-row">
        <div className="stat">
          <strong className="money">{money(ledger.earned)}</strong>
          <span>اشتغلت بيه</span>
        </div>
        <div className="stat">
          <strong className="money">{money(ledger.paid)}</strong>
          <span>استلمت</span>
        </div>
        <div className="stat">
          <strong className="money">{money(ledger.credit > 0 ? ledger.credit : ledger.owed)}</strong>
          <span>{ledger.credit > 0 ? 'دافع مقدّم' : ledger.lateDays ? `ليك (متأخر ${num(ledger.lateDays)} يوم)` : 'ليك عنده'}</span>
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={() => onForm({ form: 'job', clientId: client.id })}>
          <Icon name="plus" size={18} />
          طلب جديد
        </button>
        <button className="btn btn-ghost" onClick={() => onForm({ form: 'payment', clientId: client.id })}>
          <Icon name="wallet" size={18} />
          دفعة
        </button>
      </div>

      <section className="card">
        <h2>شغل مفتوح</h2>
        {open.length === 0 ? (
          <p className="muted">مفيش شغل مفتوح.</p>
        ) : (
          <ul className="jobs">
            {open.map((j) => (
              <JobRow key={j.id} job={j} client={client} ledger={ledger} today={today} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="card">
          <button className="row-between link-row" onClick={() => setShowDone(!showDone)}>
            <h2>اتسلّم ({num(done.length)})</h2>
            <span className="muted">{showDone ? 'خبّي' : 'اعرض'}</span>
          </button>
          {showDone && (
            <ul className="jobs">
              {done.map((j) => (
                <JobRow key={j.id} job={j} client={client} ledger={ledger} today={today} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <h2>الدفعات</h2>
        {pays.length === 0 ? (
          <p className="muted">لسه مفيش دفعات.</p>
        ) : (
          <ul className="totals">
            {pays.map((p) => (
              <li key={p.id}>
                <span className="tl-text">
                  <strong className="money">{money(p.amount)}</strong>
                  <small>
                    {formatShortDate(fromKey(p.date))}
                    {p.jobId ? `، ${ledger.jobs.find((j) => j.id === p.jobId)?.title || 'طلب'}` : ''}
                    {p.note ? `، ${p.note}` : ''}
                  </small>
                </span>
                <button
                  className="icon-btn"
                  onClick={() => window.confirm(`تمسح دفعة ${money(p.amount)}؟`) && db.payments.delete(p.id)}
                  aria-label="امسح الدفعة"
                >
                  <Icon name="trash" size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function JobForm({ clients, clientId, today, onDone }) {
  const [cid, setCid] = useState(clientId || clients.find((c) => c.kind !== 'retainer')?.id || clients[0]?.id)
  const client = clients.find((c) => c.id === Number(cid))
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(client?.rate || 0)
  const [deadline, setDeadline] = useState('')
  const [deliveredNow, setDeliveredNow] = useState(false)

  useEffect(() => {
    if (client) setPrice(client.rate || 0)
  }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const isRetainer = client?.kind === 'retainer'
  const perJob = client?.kind === 'perJob'

  async function save(e) {
    e.preventDefault()
    if (!client) return
    const n = Math.max(1, Number(qty) || 1)
    if (isRetainer) {
      // للعميل الشهري: بنسجّل الفيديوهات على باقة الشهر الحالي
      const m = monthKey(fromKey(today))
      const j = await db.jobs.where('clientId').equals(client.id).filter((x) => x.kind === 'retainer' && x.month === m).first()
      if (j) await deliver(j, n, today)
      onDone()
      return
    }
    const id = await db.jobs.add({
      clientId: client.id,
      kind: client.kind,
      title: title.trim() || (n > 1 ? `${n} فيديوهات` : 'فيديو'),
      qty: n,
      delivered: 0,
      deliveries: [],
      unitPrice: perJob ? null : Number(price) || 0,
      total: perJob ? Number(price) || 0 : null,
      receivedDate: today,
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
    })
    if (deliveredNow) await deliver({ id }, n, today)
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> رجوع
      </button>
      <header className="page-head">
        <h1>{isRetainer ? 'سجّل فيديوهات على الراتب' : 'طلب شغل جديد'}</h1>
      </header>
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>العميل</span>
          <select className="input" value={cid} onChange={(e) => setCid(Number(e.target.value))}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!isRetainer && (
          <label className="field">
            <span>الشغلانة (اختياري)</span>
            <input className="input" placeholder="مثلًا: ريلز العرض الجديد" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </label>
        )}
        <label className="field">
          <span>{isRetainer ? 'عملت كام فيديو النهارده؟' : 'كام فيديو مطلوب؟'}</span>
          <input className="input" type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        {!isRetainer && (
          <label className="field">
            <span>{perJob ? 'سعر الشغلانة كلها (جنيه)' : 'سعر الفيديو (جنيه)'}</span>
            <input className="input" type="number" inputMode="numeric" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            {!perJob && Number(qty) > 1 && <small>الإجمالي: {money((Number(price) || 0) * (Number(qty) || 0))}</small>}
          </label>
        )}
        {!isRetainer && (
          <>
            <label className="field">
              <span>آخر معاد للتسليم (اختياري)</span>
              <input className="input" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
            <label className="field field-row">
              <span>سلّمته خلاص</span>
              <input type="checkbox" className="switch" checked={deliveredNow} onChange={(e) => setDeliveredNow(e.target.checked)} />
            </label>
          </>
        )}
        {isRetainer && <p className="muted">الراتب الشهري بيتحسب لوحده كل شهر. هنا بتسجّل عدد الفيديوهات بس عشان تعرف عملت قد إيه.</p>}
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
      </form>
    </>
  )
}

function PaymentForm({ clients, clientId, jobs, today, onDone }) {
  const [cid, setCid] = useState(clientId || clients[0]?.id)
  const client = clients.find((c) => c.id === Number(cid))
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [jobId, setJobId] = useState('')
  const [note, setNote] = useState('')
  const clientJobs = jobs
    .filter((j) => j.clientId === Number(cid) && !j.cancelled)
    .sort((a, b) => (b.month || b.receivedDate || '').localeCompare(a.month || a.receivedDate || ''))
    .slice(0, 12)

  async function save(e) {
    e.preventDefault()
    const v = Number(String(amount).replace(/[,٬]/g, ''))
    if (!client || !v) return
    await db.payments.add({ clientId: client.id, amount: v, date, jobId: jobId ? Number(jobId) : null, note: note.trim() })
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> رجوع
      </button>
      <header className="page-head">
        <h1>وصلتني فلوس</h1>
      </header>
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>من مين؟</span>
          <select className="input" value={cid} onChange={(e) => setCid(Number(e.target.value))}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>المبلغ (جنيه)</span>
          <input className="input" type="number" inputMode="numeric" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>التاريخ</span>
          <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>عن شغلانة معينة؟ (اختياري — لو سبتها بتتوزع على الأقدم)</span>
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">على الحساب (الأقدم الأول)</option>
            {clientJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.kind === 'retainer' ? `راتب ${monthLabel(j.month)}` : `${j.title} (${num(j.delivered || 0)}/${num(j.qty || 0)})`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>ملاحظة (اختياري)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="مثلًا: تحويل بنكي" />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ الدفعة
        </button>
      </form>
    </>
  )
}

function ClientForm({ client, onDone }) {
  const [name, setName] = useState(client?.name || '')
  const [kind, setKind] = useState(client?.kind || 'perVideo')
  const [rate, setRate] = useState(client?.rate ?? '')
  const [dueDay, setDueDay] = useState(client?.dueDay || 0)
  const [note, setNote] = useState(client?.note || '')
  const [startMonth, setStartMonth] = useState(client?.startMonth || monthKey(new Date()))

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const data = { name: name.trim(), kind, rate: Number(rate) || 0, dueDay: Number(dueDay) || 0, note: note.trim(), startMonth, active: true }
    if (client) await db.clients.update(client.id, data)
    else await db.clients.add({ ...data, order: 50 })
    await ensureRetainerJobs()
    onDone()
  }

  async function archive() {
    if (!window.confirm(`توقف التعامل مع ${client.name}؟ حساباته هتفضل محفوظة.`)) return
    await db.clients.update(client.id, { active: false })
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> رجوع
      </button>
      <header className="page-head">
        <h1>{client ? 'تعديل العميل' : 'عميل جديد'}</h1>
      </header>
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>الاسم</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus={!client} />
        </label>
        <div className="seg" role="radiogroup" aria-label="نوع الحساب">
          {Object.entries(CLIENT_KINDS).map(([id, label]) => (
            <button key={id} type="button" className={kind === id ? 'is-on' : ''} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{kind === 'retainer' ? 'المبلغ في الشهر (جنيه)' : kind === 'perVideo' ? 'سعر الفيديو (جنيه)' : 'سعر الشغلانة المعتاد (جنيه)'}</span>
          <input className="input" type="number" inputMode="numeric" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        {kind === 'retainer' && (
          <>
            <label className="field field-row">
              <span>بيدفع يوم كام؟</span>
              <select className="input input-small" value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
                <option value={0}>آخر الشهر</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {num(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-row">
              <span>من شهر</span>
              <input className="input input-small" type="month" value={startMonth} onChange={(e) => e.target.value && setStartMonth(e.target.value)} />
            </label>
          </>
        )}
        <label className="field">
          <span>ملاحظة</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
        {client && (
          <button className="btn btn-ghost btn-wide" type="button" onClick={archive}>
            وقفت التعامل معاه
          </button>
        )}
      </form>
    </>
  )
}
