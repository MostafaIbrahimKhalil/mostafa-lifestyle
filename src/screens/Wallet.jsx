import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from '../components/Icon.jsx'
import { db, setSetting } from '../db.js'
import { daysInMonth, formatShortDate, fromKey, monthKey, num, todayKey } from '../lib/dates.js'
import { clientLedger, monthLabel } from '../lib/work.js'
import { QUICK_EXAMPLES, parseQuick } from '../lib/quickadd.js'
import { speechSupported } from '../lib/recite.js'
import {
  ACCOUNT_TYPES,
  CATEGORIES,
  INCOME_CATS,
  LIMIT_CATS,
  OBLIGATION_KINDS,
  addTxn,
  balances,
  budgetSummary,
  seedBudget,
  spendByCat,
  suggestLimits,
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
    seedWallet()
      .then(seedBudget)
      .then(() => setReady(true))
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
  const debtsOpen = data.debts.filter((d) => debtLeft(d) > 0.5 && (d.dir || 'iOwe') === 'iOwe')
  const lentOpen = data.debts.filter((d) => debtLeft(d) > 0.5 && d.dir === 'owedMe')
  const iOwe = debtsOpen.reduce((s, d) => s + debtLeft(d), 0)
  const lent = lentOpen.reduce((s, d) => s + debtLeft(d), 0)
  const net = have + inEnvelopes + owedToMe + lent - iOwe - unpaidObl
  const flow = monthFlow(mk, data.txns)
  const recent = [...data.txns].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 12)
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || '—'
  const envName = (id) => data.envelopes.find((e) => e.id === id)?.name || '—'

  if (form) {
    const close = () => setForm(null)
    if (form.type === 'account') return <AccountForm account={form.account} balance={form.account ? acc[form.account.id] : 0} onDone={close} />
    if (form.type === 'envelope') return <EnvelopeForm envelope={form.envelope} accounts={accounts} balance={form.envelope ? env[form.envelope.id] || 0 : 0} onDone={close} />
    if (form.type === 'obligation') return <ObligationForm obligation={form.obligation} onDone={close} />
    if (form.type === 'debt') return <DebtForm debt={form.debt} dirPreset={form.preset?.dir} accounts={accounts} onDone={close} />
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
            <strong>{egp(owedToMe + lent)}</strong>
          </button>
          <div>
            <small>عليّا</small>
            <strong className={iOwe + unpaidObl > 0 ? 'neg' : ''}>{egp(iOwe + unpaidObl)}</strong>
          </div>
        </div>
      </section>

      <QuickAdd data={data} accounts={accounts} envelopes={envelopes} mk={mk} onForm={setForm} />

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

      <Budget mk={mk} txns={data.txns} obligations={data.obligations} settings={settings} flow={flow} />

      <section className="card">
        <div className="row-between">
          <h2>الالتزامات والفواتير</h2>
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
                    {o.name}{' '}
                    <span className="money">
                      {o.paid ? egp(o.paidTx.amount) : Number(o.amount) ? `${o.kind === 'bill' ? '≈ ' : ''}${egp(o.amount)}` : ''}
                    </span>
                    {!o.paid && !Number(o.amount) && <small className="late"> حدد المبلغ</small>}
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

      {lentOpen.length > 0 && (
        <section className="card">
          <div className="row-between">
            <h2>ليّا عند ناس</h2>
            <button className="link-btn" onClick={() => setForm({ type: 'debt', preset: { dir: 'owedMe' } })}>
              + سلفة
            </button>
          </div>
          <ul className="totals">
            {lentOpen.map((d) => (
              <li key={d.id}>
                <button className="link-row row-between" onClick={() => setForm({ type: 'debt', debt: d })}>
                  <span className="tl-text">
                    <strong>{d.person}</strong>
                    <small>{d.note || formatShortDate(fromKey(d.date))}</small>
                  </span>
                  <strong className="money pos">{egp(debtLeft(d))}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
  const [kind, setKind] = useState(obligation?.kind || 'fixed')

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const data = { name: name.trim(), amount: Number(amount) || 0, dueDay: Number(dueDay) || 1, category, kind, active: true }
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
        <div className="seg" role="radiogroup" aria-label="النوع">
          {Object.entries(OBLIGATION_KINDS).map(([id, label]) => (
            <button key={id} type="button" className={kind === id ? 'is-on' : ''} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{kind === 'bill' ? 'المتوسط في الشهر (جنيه) — ولما تدفع تكتب الحقيقي' : 'المبلغ (جنيه)'}</span>
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

function DebtForm({ debt, dirPreset, accounts, onDone }) {
  const [dir, setDir] = useState(debt?.dir || dirPreset || 'iOwe')
  const lentMode = dir === 'owedMe'
  const [person, setPerson] = useState(debt?.person || '')
  const [amount, setAmount] = useState(debt?.amount || '')
  const [note, setNote] = useState(debt?.note || '')
  const [pay, setPay] = useState('')
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type !== 'gold')?.id)
  const left = debt ? debtLeft(debt) : 0

  async function save(e) {
    e.preventDefault()
    if (!person.trim()) return
    const data = { person: person.trim(), amount: Number(amount) || 0, note: note.trim(), dir }
    if (debt) await db.debts.update(debt.id, data)
    else await db.debts.add({ ...data, date: todayKey(), paid: [] })
    onDone()
  }

  async function payNow() {
    const v = Number(pay)
    if (!v || !debt) return
    await db.debts.update(debt.id, { paid: [...(debt.paid || []), { date: todayKey(), amount: v }] })
    await addTxn(
      lentMode
        ? { type: 'income', amount: v, accountId: Number(accountId), category: 'تانية', note: `رجّعلي: ${debt.person}` }
        : { type: 'expense', amount: v, accountId: Number(accountId), category: 'تانية', note: `سداد: ${debt.person}` },
    )
    onDone()
  }

  return (
    <>
      <button className="back-btn" onClick={onDone}>
        <Icon name="chevronRight" size={18} /> المحفظة
      </button>
      <header className="page-head">
        <h1>{debt ? (lentMode ? `ليّا عند ${debt.person}` : `عليّا لـ ${debt.person}`) : lentMode ? 'سلّفت حد' : 'دين عليّا'}</h1>
        {debt && <p className="muted">فاضل {egp(left)}</p>}
      </header>
      {debt && left > 0 && (
        <section className="card add-task">
          <h2>{lentMode ? 'رجّعلي جزء' : 'سدّدت جزء'}</h2>
          <div className="row">
            <input className="input" type="number" inputMode="numeric" placeholder="المبلغ" value={pay} onChange={(e) => setPay(e.target.value)} />
            <select className="input input-small" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts
                .filter((a) => a.type !== 'gold')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {lentMode ? 'على' : 'من'} {a.name}
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
        <div className="seg" role="radiogroup" aria-label="النوع">
          <button type="button" className={!lentMode ? 'is-on' : ''} onClick={() => setDir('iOwe')}>
            عليّا لحد
          </button>
          <button type="button" className={lentMode ? 'is-on' : ''} onClick={() => setDir('owedMe')}>
            ليّا عند حد
          </button>
        </div>
        <label className="field">
          <span>{lentMode ? 'مين؟' : 'لمين؟'}</span>
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

// ===== ميزانية الشهر: المتوقع يدخل، والالتزامات، وحد لكل بند، والمفروض يفضل كام =====
function Budget({ mk, txns, obligations, settings, flow }) {
  const limits = settings.budgetLimits || {}
  const [editing, setEditing] = useState(null) // اسم البند اللي بنعدّل حده
  const [val, setVal] = useState('')
  const [suggest, setSuggest] = useState(null)
  const [editIncome, setEditIncome] = useState(false)

  const now = new Date()
  const prevMk = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevIncome = monthFlow(prevMk, txns).income
  // القاعدة: فلوس الشهر اللي فات هي اللي بتتصرف الشهر ده
  const expectedIncome = Number(settings.budgetIncome) || prevIncome || 0
  const sum = budgetSummary({ mk, txns, obligations, limits, expectedIncome })
  const prevSpent = spendByCat(prevMk, txns)
  const dayFrac = now.getDate() / daysInMonth(now.getFullYear(), now.getMonth())
  const cats = [...new Set([...LIMIT_CATS.filter((c) => c in limits || sum.spent[c]), ...Object.keys(sum.spent).filter((c) => c !== 'فواتير واشتراكات')])]
  const extra = LIMIT_CATS.filter((c) => !cats.includes(c))

  async function saveLimit(cat) {
    const v = Number(val) || 0
    const next = { ...limits }
    if (v) next[cat] = v
    else delete next[cat]
    await setSetting('budgetLimits', next)
    setEditing(null)
  }

  return (
    <section className="card budget">
      <div className="row-between">
        <h2>ميزانية {monthLabel(mk)}</h2>
        <span className={`pill ${flow.income >= flow.expense ? 'pill-ok' : 'st-slipped'}`}>
          دخل {egp(flow.income)}، صرف {egp(flow.expense)}
        </span>
      </div>

      <div className="budget-sum">
        <button className="link-row" onClick={() => setEditIncome(!editIncome)}>
          <small>هيدخل الشهر ده</small>
          <strong>{sum.income ? egp(sum.income) : 'حدده'}</strong>
          <small className="muted">
            {settings.budgetIncome ? 'إنت محدده' : prevIncome ? 'دخل الشهر اللي فات' : sum.income ? 'اللي دخل الشهر ده لحد دلوقتي' : 'دوس وحط رقم'}
          </small>
        </button>
        <div>
          <small>التزامات وفواتير</small>
          <strong>{egp(sum.oblTotal)}</strong>
          {sum.unsetObl > 0 && <small className="late">{num(sum.unsetObl)} من غير مبلغ</small>}
        </div>
        <div>
          <small>حدود الصرف</small>
          <strong>{egp(sum.limitTotal)}</strong>
        </div>
        <div className={sum.left >= 0 ? 'good' : 'bad'}>
          <small>المفروض يفضل للأظرف</small>
          <strong>{egp(sum.left)}</strong>
        </div>
      </div>
      {editIncome && (
        <label className="field field-row">
          <span>الدخل المتوقع (فاضي = دخل الشهر اللي فات)</span>
          <input
            className="input input-small"
            type="number"
            inputMode="numeric"
            defaultValue={settings.budgetIncome || ''}
            onBlur={(e) => {
              setSetting('budgetIncome', Number(e.target.value) || 0)
              setEditIncome(false)
            }}
            autoFocus
          />
        </label>
      )}

      <ul className="bars budget-cats">
        {cats.map((c) => {
          const spent = sum.spent[c] || 0
          const lim = Number(limits[c]) || 0
          const r = lim ? spent / lim : 0
          const ahead = lim && r > dayFrac + 0.15 && r < 1
          const prev = prevSpent[c] || 0
          const trend = prev ? (spent / dayFrac - prev) / prev : 0
          return (
            <li key={c}>
              {editing === c ? (
                <div className="row">
                  <input className="input" type="number" inputMode="numeric" placeholder="الحد في الشهر (٠ = من غير حد)" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                  <button className="btn btn-small" onClick={() => saveLimit(c)}>
                    حفظ
                  </button>
                </div>
              ) : (
                <button
                  className="link-row budget-row"
                  onClick={() => {
                    setEditing(c)
                    setVal(lim || '')
                  }}
                >
                  <div className="row-between">
                    <span>
                      {c}
                      {prev > 0 && Math.abs(trend) >= 0.2 && dayFrac > 0.25 && (
                        <small className={trend > 0 ? 'neg' : 'pos'}> {trend > 0 ? '↑' : '↓'} عن الشهر اللي فات</small>
                      )}
                    </span>
                    <span className={r >= 1 ? 'neg' : 'muted'}>
                      {egp(spent)}
                      {lim ? ` من ${egp(lim)}` : ' — حط حد'}
                    </span>
                  </div>
                  {lim > 0 && (
                    <>
                      <span className="bar" style={{ '--bar': r >= 1 ? 'var(--c-health)' : ahead ? 'var(--c-money)' : 'var(--c-faith)' }}>
                        <span style={{ width: `${Math.min(1, r) * 100}%` }} />
                      </span>
                      <small className={r >= 1 ? 'neg' : ahead ? 'late' : 'muted'}>
                        {r >= 1 ? `زاد ${egp(spent - lim)}` : `فاضلك ${egp(lim - spent)}${ahead ? '، بتصرف أسرع من الشهر' : ''}`}
                      </small>
                    </>
                  )}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {extra.length > 0 && (
        <div className="chip-wrap">
          {extra.map((c) => (
            <button
              key={c}
              className="chip"
              onClick={() => {
                setEditing(c)
                setVal('')
                setSetting('budgetLimits', { ...limits, [c]: 0 })
              }}
            >
              + {c}
            </button>
          ))}
        </div>
      )}

      {suggest ? (
        <div className="suggest">
          {suggest.basis === 'none' ? (
            <p className="muted">لسه مفيش صرف كفاية. سجّل صرفك أسبوعين على الأقل وجرّب تاني.</p>
          ) : (
            <>
              <p className="muted">
                {suggest.basis === 'current' ? 'على حسب صرفك الشهر ده لحد دلوقتي:' : `على حسب متوسط آخر ${num(Number(suggest.basis))} شهر:`}
              </p>
              <ul className="totals">
                {Object.entries(suggest.limits)
                  .filter(([c]) => c !== 'فواتير واشتراكات')
                  .map(([c, v]) => (
                    <li key={c}>
                      <span>{c}</span>
                      <strong>{egp(v)}</strong>
                    </li>
                  ))}
              </ul>
              <div className="row">
                <button
                  className="btn btn-small"
                  onClick={async () => {
                    const { ['فواتير واشتراكات']: _, ...rest } = suggest.limits
                    await setSetting('budgetLimits', { ...limits, ...rest })
                    setSuggest(null)
                  }}
                >
                  خليهم الحدود
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => setSuggest(null)}>
                  لأ
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className="btn btn-ghost btn-wide" onClick={() => setSuggest(suggestLimits(txns))}>
          اقترح حدود من صرفي
        </button>
      )}
    </section>
  )
}

// ===== اكتب زي ما بتتكلم =====
const TYPE_ICON = { expense: '−', income: '+', iOwe: 'عليّا', owedMe: 'ليّا', obligation: 'كل شهر', payObligation: 'اتدفع', payDebt: 'سداد', collectDebt: 'رجّعلي', toEnvelope: 'ظرف', goal: 'هدف', gold: 'دهب' }

function QuickAdd({ data, accounts, envelopes, mk, onForm }) {
  const [text, setText] = useState('')
  const [p, setP] = useState(null)
  const [cat, setCat] = useState(null)
  const [acc, setAcc] = useState(null)
  const [env, setEnv] = useState(null)
  const [done, setDone] = useState(null)
  const [listening, setListening] = useState(false)
  const [help, setHelp] = useState(false)
  const stopRef = useRef(null)

  function parse(t = text) {
    const r = parseQuick(t, { obligations: data.obligations, clients: data.clients, envelopes, debts: data.debts })
    setP(r)
    setCat(r?.category || null)
    setEnv(r?.envelope?.id || envelopes[0]?.id || null)
    const want = r?.type === 'gold' ? 'cash' : r?.accountHint
    setAcc((accounts.find((a) => a.type === want) || accounts.find((a) => a.type !== 'gold'))?.id || null)
  }

  function mic() {
    if (listening) {
      stopRef.current?.()
      return
    }
    setListening(true)
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SR()
      rec.lang = 'ar-EG'
      rec.interimResults = false
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript
        setText(t)
        parse(t)
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      rec.start()
      stopRef.current = () => rec.stop()
    } catch {
      setListening(false)
    }
  }

  async function commit() {
    const v = Number(p.amount) || 0
    const accountId = Number(acc)
    const base = { date: p.date, month: p.date.slice(0, 7) }
    switch (p.type) {
      case 'expense':
        await addTxn({ ...base, type: 'expense', amount: v, accountId, category: cat || 'تانية', note: p.note })
        break
      case 'income':
        if (p.client) {
          await db.transaction('rw', db.payments, db.txns, async () => {
            const pid = await db.payments.add({ clientId: p.client.id, amount: v, date: p.date, jobId: null, note: 'من المحفظة' })
            await db.txns.add({ ...base, type: 'income', amount: v, accountId, category: 'شغل', note: p.client.name, paymentId: pid, createdAt: new Date().toISOString() })
          })
        } else await addTxn({ ...base, type: 'income', amount: v, accountId, category: p.category || 'تانية', note: p.note })
        break
      case 'iOwe':
      case 'owedMe':
        if (!p.person) return onForm({ type: 'debt', preset: { dir: p.type } })
        await db.debts.add({ person: p.person, amount: v, date: p.date, note: '', paid: [], dir: p.type })
        break
      case 'obligation':
        await db.obligations.add({ name: p.name, amount: v, dueDay: p.dueDay, category: p.category, kind: p.kind, active: true })
        break
      case 'payObligation':
        await addTxn({ type: 'expense', amount: v || Number(p.obligation.amount) || 0, accountId, category: p.category, note: p.obligation.name, obligationId: p.obligation.id, month: mk, date: p.date })
        break
      case 'payDebt':
      case 'collectDebt':
        await db.debts.update(p.debt.id, { paid: [...(p.debt.paid || []), { date: p.date, amount: v }] })
        await addTxn({ ...base, type: p.type === 'payDebt' ? 'expense' : 'income', amount: v, accountId, category: 'تانية', note: `${p.type === 'payDebt' ? 'سداد' : 'رجّعلي'}: ${p.debt.person}` })
        break
      case 'toEnvelope':
        if (!env) return
        await addTxn({ ...base, type: 'toEnvelope', amount: v, accountId, envelopeId: Number(env) })
        break
      case 'gold': {
        const gold = accounts.find((a) => a.type === 'gold')
        if (!gold) return
        await addTxn({ ...base, type: 'transfer', amount: v, accountId, toAccountId: gold.id, toAmount: p.grams || 0 })
        break
      }
      case 'goal':
        if (p.envelope) await db.envelopes.update(p.envelope.id, { target: v })
        else await db.envelopes.add({ name: p.name, target: v, kind: 'cash', priority: envelopes.length + 1, active: true })
        break
      default:
        return
    }
    setDone(`اتسجّل: ${p.label}${v ? ` ${p.type === 'gold' ? egp(v) : egp(v)}` : ''}`)
    setText('')
    setP(null)
    setTimeout(() => setDone(null), 3500)
  }

  const needsAccount = ['expense', 'income', 'payObligation', 'payDebt', 'collectDebt', 'toEnvelope', 'gold'].includes(p?.type)
  return (
    <section className="card quick-add">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          parse()
        }}
      >
        <input
          className="input"
          placeholder="اكتب زي ما بتتكلم: اشتريت قهوة ب ٤٠"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (p) setP(null)
          }}
          enterKeyHint="done"
        />
        {speechSupported() && (
          <button type="button" className={`icon-btn mic-mini ${listening ? 'is-on' : ''}`} onClick={mic} aria-label="قول بصوتك">
            <Icon name="mic" size={20} />
          </button>
        )}
        <button className="btn btn-small" type="submit" disabled={!text.trim()}>
          ←
        </button>
      </form>
      {done && <p className="qa-done">{done} ✓</p>}
      {!p && !done && !text && (
        <button className="link-btn qa-help" onClick={() => setHelp(!help)}>
          {help ? 'خلاص' : 'أمثلة؟'}
        </button>
      )}
      {help && !p && !text && (
        <ul className="qa-examples-list">
          {QUICK_EXAMPLES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {p && (
        <div className={`qa-preview ${p.type === 'unknown' ? 'is-bad' : ''}`}>
          <div className="row-between">
            <span className="qa-type">{TYPE_ICON[p.type] || '؟'}</span>
            <strong className="qa-label">{p.label}</strong>
            {p.amount > 0 && <strong className="money">{egp(p.amount)}</strong>}
          </div>
          {p.type === 'gold' && <small className="muted">{num(p.grams || 0)} جرام</small>}
          {p.note && p.type === 'expense' && <small className="muted">{p.note}</small>}
          {p.date !== todayKey() && <small className="muted">بتاريخ امبارح</small>}
          {p.type === 'expense' && (
            <div className="chip-wrap">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={`chip ${cat === c ? 'chip-on' : ''}`} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {p.type === 'toEnvelope' && (
            <select className="input" value={env || ''} onChange={(e) => setEnv(e.target.value)}>
              {envelopes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
          {needsAccount && (
            <select className="input" value={acc || ''} onChange={(e) => setAcc(e.target.value)}>
              {accounts
                .filter((a) => a.type !== 'gold')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {p.type === 'income' || p.type === 'collectDebt' ? 'دخلت على' : 'من'} {a.name}
                  </option>
                ))}
            </select>
          )}
          {p.type !== 'unknown' && (
            <div className="row">
              <button className="btn" onClick={commit} disabled={!p.amount && !['goal'].includes(p.type)}>
                سجّل
              </button>
              <button className="btn btn-ghost" onClick={() => setP(null)}>
                لأ
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
