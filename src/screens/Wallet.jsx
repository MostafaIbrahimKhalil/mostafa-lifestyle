import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setSetting } from '../db.js'
import { formatShortDate, fromKey, monthKey, num, todayKey } from '../lib/dates.js'
import { clientLedger, monthLabel } from '../lib/work.js'
import {
  ACCOUNT_TYPES,
  CATEGORIES,
  INCOME_CATS,
  addTxn,
  balances,
  debtLeft,
  egp,
  grams,
  monthFlow,
  obligationsFor,
  seedWallet,
  valueOf,
} from '../lib/wallet.js'

export default function Wallet({ settings, onOpenWork }) {
  const today = todayKey()
  const mk = monthKey(new Date())
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState(null)

  useEffect(() => {
    seedWallet().then(() => setReady(true))
  }, [])

  const data = useLiveQuery(async () => {
    const [accounts, txns, envelopes, obligations, shopping, debts, clients, jobs, payments] = await Promise.all([
      db.accounts.toArray(),
      db.txns.toArray(),
      db.envelopes.toArray(),
      db.obligations.toArray(),
      db.shopping.toArray(),
      db.debts.toArray(),
      db.clients.toArray(),
      db.jobs.toArray(),
      db.payments.toArray(),
    ])
    return { accounts, txns, envelopes, obligations, shopping, debts, clients, jobs, payments }
  }, [])

  if (!ready || !data) return null
  const goldPrice = settings.goldPrice || 0
  const accounts = data.accounts.filter((a) => a.active !== false).sort((a, b) => (a.order || 9) - (b.order || 9))
  const envelopes = data.envelopes.filter((e) => e.active !== false).sort((a, b) => (a.priority || 9) - (b.priority || 9))
  const { acc, env } = balances(data.accounts, data.txns, data.envelopes)
  const goldAcc = accounts.find((a) => a.type === 'gold')

  const have = accounts.reduce((s, a) => s + valueOf(a, acc[a.id] || 0, goldPrice), 0)
  const inEnvelopes = envelopes.reduce((s, e) => s + (e.kind === 'gold' ? (env[e.id] || 0) * goldPrice : env[e.id] || 0), 0)
  const owedToMe = data.clients.reduce((s, c) => s + clientLedger(c, data.jobs, data.payments).owed, 0)
  const obls = obligationsFor(mk, data.obligations, data.txns)
  const unpaidObl = obls.filter((o) => !o.paid).reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const debtsOpen = data.debts.filter((d) => debtLeft(d) > 0.5)
  const iOwe = debtsOpen.reduce((s, d) => s + debtLeft(d), 0)
  const net = have + inEnvelopes + owedToMe - iOwe - unpaidObl
  const flow = monthFlow(mk, data.txns)
  const recent = [...data.txns].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 12)
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || '—'
  const envName = (id) => data.envelopes.find((e) => e.id === id)?.name || '—'

  if (form) {
    const close = () => setForm(null)
    if (form.type === 'account') return <AccountForm account={form.account} balance={form.account ? acc[form.account.id] : 0} onDone={close} />
    if (form.type === 'envelope') return <EnvelopeForm envelope={form.envelope} accounts={accounts} balance={form.envelope ? env[form.envelope.id] || 0 : 0} onDone={close} />
    if (form.type === 'obligation') return <ObligationForm obligation={form.obligation} onDone={close} />
    if (form.type === 'debt') return <DebtForm debt={form.debt} accounts={accounts} onDone={close} />
    return <TxnForm kind={form.type} accounts={accounts} envelopes={envelopes} preset={form.preset} goldPrice={goldPrice} onDone={close} />
  }

  return (
    <>
      <header className="page-head">
        <h1>المحفظة</h1>
        <p className="muted">معاك كام، وليك كام، وعليك كام</p>
      </header>

      <section className="card net-card">
        <span className="tasks-label">الصافي</span>
        <strong className="net">{egp(net)}</strong>
        <div className="net-grid">
          <div>
            <small>معايا</small>
            <strong>{egp(have)}</strong>
          </div>
          <div>
            <small>في الأظرف</small>
            <strong>{egp(inEnvelopes)}</strong>
          </div>
          <button className="link-row" onClick={onOpenWork}>
            <small>ليا برّه</small>
            <strong>{egp(owedToMe)}</strong>
          </button>
          <div>
            <small>عليّا</small>
            <strong className={iOwe + unpaidObl > 0 ? 'neg' : ''}>{egp(iOwe + unpaidObl)}</strong>
          </div>
        </div>
      </section>

      <div className="quick-grid">
        <button className="btn" onClick={() => setForm({ type: 'expense' })}>
          <Icon name="upload" size={18} /> صرفت
        </button>
        <button className="btn btn-ghost" onClick={() => setForm({ type: 'income' })}>
          <Icon name="download" size={18} /> دخلّي
        </button>
        <button className="btn btn-ghost" onClick={() => setForm({ type: 'transfer' })}>
          <Icon name="refresh" size={18} /> حوّلت
        </button>
        <button className="btn btn-ghost" onClick={() => setForm({ type: 'toEnvelope' })}>
          <Icon name="wallet" size={18} /> حوّشت
        </button>
      </div>

      <section className="card">
        <div className="row-between">
          <h2>حساباتي</h2>
          <button className="link-btn" onClick={() => setForm({ type: 'account' })}>
            + حساب
          </button>
        </div>
        <ul className="totals">
          {accounts.map((a) => (
            <li key={a.id}>
              <button className="link-row row-between" onClick={() => setForm({ type: 'account', account: a })}>
                <span className="tl-text">
                  <strong>{a.name}</strong>
                  <small>
                    {ACCOUNT_TYPES[a.type]}
                    {a.type === 'gold' && goldPrice ? `، ≈ ${egp((acc[a.id] || 0) * goldPrice)}` : ''}
                  </small>
                </span>
                <strong className="money">{a.type === 'gold' ? grams(acc[a.id]) : egp(acc[a.id])}</strong>
              </button>
            </li>
          ))}
        </ul>
        {goldAcc && (
          <label className="field field-row">
            <span>سعر جرام الدهب النهارده</span>
            <input
              className="input input-small"
              type="number"
              inputMode="numeric"
              placeholder="جنيه"
              defaultValue={goldPrice || ''}
              onBlur={(e) => setSetting('goldPrice', Number(e.target.value) || 0)}
            />
          </label>
        )}
        {goldAcc && (
          <button className="btn btn-ghost btn-wide" onClick={() => setForm({ type: 'transfer', preset: { toAccountId: goldAcc.id } })}>
            اشتريت دهب
          </button>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>{monthLabel(mk)}</h2>
          <span className={`pill ${flow.income >= flow.expense ? 'pill-ok' : 'st-slipped'}`}>
            {flow.income >= flow.expense ? `فاضل ${egp(flow.income - flow.expense)}` : `صرفت أكتر بـ ${egp(flow.expense - flow.income)}`}
          </span>
        </div>
        <div className="flow">
          <div>
            <small>دخل</small>
            <strong className="pos">{egp(flow.income)}</strong>
          </div>
          <div>
            <small>صرف</small>
            <strong className="neg">{egp(flow.expense)}</strong>
          </div>
        </div>
        {flow.byCat.length > 0 && (
          <ul className="bars">
            {flow.byCat.map(([cat, v]) => (
              <li key={cat}>
                <div className="row-between">
                  <span>{cat}</span>
                  <span className="muted">{egp(v)}</span>
                </div>
                <span className="bar" style={{ '--bar': 'var(--c-money)' }}>
                  <span style={{ width: `${(v / flow.expense) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>التزامات الشهر</h2>
          <button className="link-btn" onClick={() => setForm({ type: 'obligation' })}>
            + التزام
          </button>
        </div>
        {obls.length === 0 ? (
          <p className="muted">الإيجار، الفواتير، المدرسة، الأقساط، الاشتراكات… ضيفها مرة واحدة وبتتكرر كل شهر.</p>
        ) : (
          <ul className="tasks">
            {obls.map((o) => (
              <li key={o.id} className={`task ${o.paid ? 'is-done' : ''}`}>
                <button className="task-title link-row" onClick={() => setForm({ type: 'obligation', obligation: o })}>
                  <span>
                    {o.name} <span className="money">{egp(o.amount)}</span>
                  </span>
                  <small className={!o.paid && o.due < today ? 'late' : 'muted'}>
                    {o.paid ? `اتدفع ${formatShortDate(fromKey(o.paidTx.date))}` : `معاده ${formatShortDate(fromKey(o.due))}`}
                  </small>
                </button>
                <button
                  className={`check ${o.paid ? 'is-done' : ''}`}
                  onClick={() =>
                    o.paid
                      ? db.txns.delete(o.paidTx.id)
                      : setForm({ type: 'expense', preset: { amount: o.amount, category: o.category, note: o.name, obligationId: o.id, month: mk } })
                  }
                  aria-pressed={o.paid}
                  aria-label={`دفعت ${o.name}`}
                >
                  <Icon name="check" size={18} stroke={2.6} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Shopping items={data.shopping} mk={mk} onSpend={() => setForm({ type: 'expense', preset: { category: 'أكل وبيت', note: 'مشتريات الشهر' } })} />

      <section className="card">
        <div className="row-between">
          <h2>الأظرف</h2>
          <button className="link-btn" onClick={() => setForm({ type: 'envelope' })}>
            + ظرف
          </button>
        </div>
        <ul className="habits">
          {envelopes.map((e) => {
            const bal = env[e.id] || 0
            const p = e.target ? Math.min(1, bal / e.target) : 0
            return (
              <li key={e.id}>
                <button className="hifz link-row env-row" onClick={() => setForm({ type: 'envelope', envelope: e })}>
                  <span className="row-between">
                    <span className="habit-name">
                      {num(e.priority || 0)}. {e.name}
                    </span>
                    <span className="money">
                      {e.kind === 'gold' ? grams(bal) : egp(bal)}
                      {e.target ? ` / ${e.kind === 'gold' ? grams(e.target) : egp(e.target)}` : ''}
                    </span>
                  </span>
                  <span className="bar bar-thin" style={{ '--bar': 'var(--c-money)' }}>
                    <span style={{ width: `${p * 100}%` }} />
                  </span>
                  {!e.target && <small className="muted">حدد هدف الظرف</small>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>عليّا</h2>
          <button className="link-btn" onClick={() => setForm({ type: 'debt' })}>
            + دين
          </button>
        </div>
        {debtsOpen.length === 0 ? (
          <p className="muted">مفيش ديون عليك ✓</p>
        ) : (
          <ul className="totals">
            {debtsOpen.map((d) => (
              <li key={d.id}>
                <button className="link-row row-between" onClick={() => setForm({ type: 'debt', debt: d })}>
                  <span className="tl-text">
                    <strong>{d.person}</strong>
                    <small>{d.note || formatShortDate(fromKey(d.date))}</small>
                  </span>
                  <strong className="money neg">{egp(debtLeft(d))}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2>آخر الحركات</h2>
          <ul className="totals">
            {recent.map((t) => (
              <li key={t.id}>
                <span className="tl-text">
                  <strong>
                    {t.type === 'expense' && `صرف: ${t.note || t.category}`}
                    {t.type === 'income' && `دخل: ${t.note || t.category}`}
                    {t.type === 'transfer' && `تحويل: ${accName(t.accountId)} ← ${accName(t.toAccountId)}`}
                    {t.type === 'toEnvelope' && `تحويش: ${envName(t.envelopeId)}`}
                    {t.type === 'fromEnvelope' && `سحب من: ${envName(t.envelopeId)}`}
                    {t.type === 'adjust' && `ظبط رصيد ${accName(t.accountId)}`}
                  </strong>
                  <small>
                    {formatShortDate(fromKey(t.date))}، {accName(t.accountId)}
                  </small>
                </span>
                <span className="row">
                  <strong className={`money ${t.type === 'expense' ? 'neg' : t.type === 'income' ? 'pos' : ''}`}>
                    {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
                    {data.accounts.find((a) => a.id === t.accountId)?.type === 'gold' ? grams(t.amount) : egp(t.amount)}
                  </strong>
                  {t.paymentId ? (
                    <span className="icon-spacer" title="بتتمسح من صفحة الشغل" />
                  ) : (
                    <button className="icon-btn" onClick={() => window.confirm('تمسح الحركة دي؟') && db.txns.delete(t.id)} aria-label="امسح">
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Shopping({ items, mk, onSpend }) {
  const [name, setName] = useState('')
  const list = items.filter((i) => i.active !== false)
  const bought = list.filter((i) => (i.boughtMonths || []).includes(mk)).length

  async function toggle(i) {
    const set = new Set(i.boughtMonths || [])
    if (set.has(mk)) set.delete(mk)
    else set.add(mk)
    await db.shopping.update(i.id, { boughtMonths: [...set] })
  }

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    await db.shopping.add({ name: name.trim(), active: true, boughtMonths: [] })
    setName('')
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>مشتريات الشهر</h2>
        {list.length > 0 && (
          <span className="pill">
            {num(bought)} من {num(list.length)}
          </span>
        )}
      </div>
      {list.length === 0 && <p className="muted">القايمة اللي بتشتريها كل شهر. بترجع فاضية أول كل شهر.</p>}
      <ul className="tasks">
        {list.map((i) => {
          const done = (i.boughtMonths || []).includes(mk)
          return (
            <li key={i.id} className={`task ${done ? 'is-done' : ''}`}>
              <span className="task-title">{i.name}</span>
              <button className="icon-btn" onClick={() => db.shopping.update(i.id, { active: false })} aria-label="شيل">
                <Icon name="trash" size={16} />
              </button>
              <button className={`check ${done ? 'is-done' : ''}`} onClick={() => toggle(i)} aria-pressed={done} aria-label={i.name}>
                <Icon name="check" size={18} stroke={2.6} />
              </button>
            </li>
          )
        })}
      </ul>
      <form className="row" onSubmit={add}>
        <input className="input" placeholder="ضيف حاجة…" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <button className="btn" type="submit" aria-label="ضيف">
          <Icon name="plus" size={18} />
        </button>
      </form>
      {bought > 0 && (
        <button className="btn btn-ghost btn-wide" onClick={onSpend}>
          سجّل اللي صرفته على المشتريات
        </button>
      )}
    </section>
  )
}

const TXN_TITLES = { expense: 'صرفت', income: 'دخلّي فلوس', transfer: 'تحويل بين حساباتي', toEnvelope: 'حوّشت في ظرف', fromEnvelope: 'سحبت من ظرف' }

function TxnForm({ kind, accounts, envelopes, preset = {}, goldPrice, onDone }) {
  const nonGold = accounts.filter((a) => a.type !== 'gold')
  const [accountId, setAccountId] = useState(preset.accountId || nonGold[0]?.id || accounts[0]?.id)
  const [toAccountId, setToAccountId] = useState(preset.toAccountId || accounts.find((a) => a.id !== accountId)?.id)
  const [envelopeId, setEnvelopeId] = useState(preset.envelopeId || envelopes[0]?.id)
  const [amount, setAmount] = useState(preset.amount || '')
  const [toAmount, setToAmount] = useState('')
  const [category, setCategory] = useState(preset.category || (kind === 'income' ? INCOME_CATS[0] : CATEGORIES[0]))
  const [note, setNote] = useState(preset.note || '')
  const [date, setDate] = useState(todayKey())
  const from = accounts.find((a) => a.id === Number(accountId))
  const to = accounts.find((a) => a.id === Number(toAccountId))
  const env = envelopes.find((e) => e.id === Number(envelopeId))
  const buyingGold = kind === 'transfer' && to?.type === 'gold' && from?.type !== 'gold'
  const envGold = (kind === 'toEnvelope' || kind === 'fromEnvelope') && env?.kind === 'gold'
  const accChoices = envGold ? accounts.filter((a) => a.type === 'gold') : kind === 'toEnvelope' || kind === 'fromEnvelope' ? nonGold : accounts

  async function save(e) {
    e.preventDefault()
    const v = Number(amount)
    if (!v) return
    const base = { type: kind, amount: v, accountId: Number(accountId), date, month: preset.month || date.slice(0, 7), note: note.trim() }
    if (kind === 'expense' || kind === 'income') await addTxn({ ...base, category, obligationId: preset.obligationId || null })
    if (kind === 'transfer') {
      if (Number(accountId) === Number(toAccountId)) return
      await addTxn({ ...base, toAccountId: Number(toAccountId), toAmount: buyingGold ? Number(toAmount) || 0 : v })
    }
    if (kind === 'toEnvelope' || kind === 'fromEnvelope') await addTxn({ ...base, envelopeId: Number(envelopeId) })
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{buyingGold ? 'اشتريت دهب' : TXN_TITLES[kind]}</h1>
      </header>
      <form className="card add-task" onSubmit={save}>
        {(kind === 'toEnvelope' || kind === 'fromEnvelope') && (
          <>
            <label className="field">
              <span>الظرف</span>
              <select className="input" value={envelopeId} onChange={(e) => setEnvelopeId(Number(e.target.value))}>
                {envelopes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} {x.kind === 'gold' ? '(دهب)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span>{kind === 'transfer' ? 'من حساب' : kind === 'income' || kind === 'fromEnvelope' ? 'دخلت على' : 'من حساب'}</span>
          <select className="input" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accChoices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {kind === 'transfer' && (
          <label className="field">
            <span>لحساب</span>
            <select className="input" value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value))}>
              {accounts
                .filter((a) => a.id !== Number(accountId))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{envGold || from?.type === 'gold' ? 'كام جرام؟' : buyingGold ? 'دفعت كام (جنيه)؟' : 'المبلغ (جنيه)'}</span>
          <input className="input" type="number" inputMode="decimal" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        {buyingGold && (
          <label className="field">
            <span>كام جرام؟</span>
            <input className="input" type="number" inputMode="decimal" step="0.01" min="0" value={toAmount} onChange={(e) => setToAmount(e.target.value)} />
            {Number(amount) > 0 && Number(toAmount) > 0 && <small>سعر الجرام عليك: {egp(Number(amount) / Number(toAmount))}{goldPrice ? `، النهارده ${egp(goldPrice)}` : ''}</small>}
          </label>
        )}
        {(kind === 'expense' || kind === 'income') && (
          <div className="chip-wrap" role="radiogroup" aria-label="التصنيف">
            {(kind === 'income' ? INCOME_CATS : CATEGORIES).map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? 'chip-on' : ''}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>ملاحظة (اختياري)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} />
        </label>
        <label className="field field-row">
          <span>التاريخ</span>
          <input className="input input-small" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
      </form>
    </>
  )
}

function AccountForm({ account, balance, onDone }) {
  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState(account?.type || 'cash')
  const [newBal, setNewBal] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    if (account) {
      await db.accounts.update(account.id, { name: name.trim(), type })
      if (newBal !== '' && Number(newBal) !== balance) {
        await addTxn({ type: 'adjust', accountId: account.id, amount: Number(newBal) - balance, note: 'ظبط الرصيد' })
      }
    } else {
      await db.accounts.add({ name: name.trim(), type, opening: Number(newBal) || 0, order: 9, active: true })
    }
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{account ? account.name : 'حساب جديد'}</h1>
        {account && <p className="muted">الرصيد دلوقتي: {type === 'gold' ? grams(balance) : egp(balance)}</p>}
      </header>
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>الاسم</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <div className="seg" role="radiogroup" aria-label="النوع">
          {Object.entries(ACCOUNT_TYPES).map(([id, label]) => (
            <button key={id} type="button" className={type === id ? 'is-on' : ''} onClick={() => setType(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{account ? 'الرصيد الحقيقي دلوقتي (لو مختلف)' : 'معاك فيه كام دلوقتي؟'} {type === 'gold' ? '(جرام)' : '(جنيه)'}</span>
          <input className="input" type="number" inputMode="decimal" step="any" value={newBal} onChange={(e) => setNewBal(e.target.value)} placeholder={account ? String(Math.round(balance * 100) / 100) : '0'} />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
        {account && (
          <button
            type="button"
            className="btn btn-ghost btn-wide"
            onClick={async () => {
              if (window.confirm(`تقفل حساب ${account.name}؟`)) {
                await db.accounts.update(account.id, { active: false })
                onDone()
              }
            }}
          >
            قفل الحساب
          </button>
        )}
      </form>
    </>
  )
}

function EnvelopeForm({ envelope, accounts, balance, onDone }) {
  const [name, setName] = useState(envelope?.name || '')
  const [target, setTarget] = useState(envelope?.target || '')
  const [kind, setKind] = useState(envelope?.kind || 'cash')
  const [priority, setPriority] = useState(envelope?.priority || 9)
  const [move, setMove] = useState(null) // 'in' | 'out'

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const data = { name: name.trim(), target: Number(target) || 0, kind, priority: Number(priority) || 9, active: true }
    if (envelope) await db.envelopes.update(envelope.id, data)
    else await db.envelopes.add(data)
    onDone()
  }

  if (move && envelope)
    return (
      <TxnForm
        kind={move === 'in' ? 'toEnvelope' : 'fromEnvelope'}
        accounts={accounts}
        envelopes={[envelope]}
        preset={{ envelopeId: envelope.id }}
        onDone={onDone}
      />
    )

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{envelope ? envelope.name : 'ظرف جديد'}</h1>
        {envelope && (
          <p className="muted">
            فيه دلوقتي {kind === 'gold' ? grams(balance) : egp(balance)}
            {envelope.target ? `، فاضل ${kind === 'gold' ? grams(Math.max(0, envelope.target - balance)) : egp(Math.max(0, envelope.target - balance))}` : ''}
          </p>
        )}
      </header>
      {envelope && (
        <div className="row">
          <button className="btn" onClick={() => setMove('in')}>
            حوّشت فيه
          </button>
          <button className="btn btn-ghost" onClick={() => setMove('out')} disabled={balance <= 0}>
            سحبت منه
          </button>
        </div>
      )}
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>الاسم</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <div className="seg" role="radiogroup" aria-label="النوع">
          <button type="button" className={kind === 'cash' ? 'is-on' : ''} onClick={() => setKind('cash')}>
            فلوس
          </button>
          <button type="button" className={kind === 'gold' ? 'is-on' : ''} onClick={() => setKind('gold')}>
            دهب
          </button>
        </div>
        <label className="field">
          <span>الهدف {kind === 'gold' ? '(جرام)' : '(جنيه)'}</span>
          <input className="input" type="number" inputMode="decimal" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="field field-row">
          <span>الأولوية (١ = الأهم)</span>
          <input className="input input-small" type="number" inputMode="numeric" min="1" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
      </form>
    </>
  )
}

function ObligationForm({ obligation, onDone }) {
  const [name, setName] = useState(obligation?.name || '')
  const [amount, setAmount] = useState(obligation?.amount || '')
  const [dueDay, setDueDay] = useState(obligation?.dueDay || 1)
  const [category, setCategory] = useState(obligation?.category || 'فواتير واشتراكات')

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const data = { name: name.trim(), amount: Number(amount) || 0, dueDay: Number(dueDay) || 1, category, active: true }
    if (obligation) await db.obligations.update(obligation.id, data)
    else await db.obligations.add(data)
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{obligation ? obligation.name : 'التزام شهري'}</h1>
      </header>
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>الالتزام</span>
          <input className="input" placeholder="مثلًا: الإيجار، النت، قسط…" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <label className="field">
          <span>المبلغ (جنيه)</span>
          <input className="input" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field field-row">
          <span>يوم كام في الشهر؟</span>
          <input className="input input-small" type="number" inputMode="numeric" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </label>
        <div className="chip-wrap" role="radiogroup" aria-label="التصنيف">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`chip ${category === c ? 'chip-on' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
        {obligation && (
          <button
            type="button"
            className="btn btn-ghost btn-wide"
            onClick={async () => {
              await db.obligations.update(obligation.id, { active: false })
              onDone()
            }}
          >
            خلص الالتزام ده
          </button>
        )}
      </form>
    </>
  )
}

function DebtForm({ debt, accounts, onDone }) {
  const [person, setPerson] = useState(debt?.person || '')
  const [amount, setAmount] = useState(debt?.amount || '')
  const [note, setNote] = useState(debt?.note || '')
  const [pay, setPay] = useState('')
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type !== 'gold')?.id)
  const left = debt ? debtLeft(debt) : 0

  async function save(e) {
    e.preventDefault()
    if (!person.trim()) return
    const data = { person: person.trim(), amount: Number(amount) || 0, note: note.trim() }
    if (debt) await db.debts.update(debt.id, data)
    else await db.debts.add({ ...data, date: todayKey(), paid: [] })
    onDone()
  }

  async function payNow() {
    const v = Number(pay)
    if (!v || !debt) return
    await db.debts.update(debt.id, { paid: [...(debt.paid || []), { date: todayKey(), amount: v }] })
    await addTxn({ type: 'expense', amount: v, accountId: Number(accountId), category: 'تانية', note: `سداد: ${debt.person}` })
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{debt ? `عليّا لـ ${debt.person}` : 'دين عليّا'}</h1>
        {debt && <p className="muted">فاضل {egp(left)}</p>}
      </header>
      {debt && left > 0 && (
        <section className="card add-task">
          <h2>سدّدت جزء</h2>
          <div className="row">
            <input className="input" type="number" inputMode="numeric" placeholder="المبلغ" value={pay} onChange={(e) => setPay(e.target.value)} />
            <select className="input input-small" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts
                .filter((a) => a.type !== 'gold')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    من {a.name}
                  </option>
                ))}
            </select>
          </div>
          <button className="btn btn-wide" onClick={payNow}>
            سجّل السداد
          </button>
        </section>
      )}
      <form className="card add-task" onSubmit={save}>
        <label className="field">
          <span>لمين؟</span>
          <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={30} />
        </label>
        <label className="field">
          <span>المبلغ كله (جنيه)</span>
          <input className="input" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>ملاحظة</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} />
        </label>
        <button className="btn btn-wide btn-big" type="submit">
          حفظ
        </button>
      </form>
    </>
  )
}
