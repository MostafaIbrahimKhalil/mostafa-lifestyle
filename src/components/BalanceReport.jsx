import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { addDays, dateKey, fromKey, monthKey, num, todayKey } from '../lib/dates.js'
import { PRAYERS } from '../lib/prayer.js'
import { egp, monthFlow, obligationsFor } from '../lib/wallet.js'

const ASPECTS = [
  { id: 'faith', name: 'العبادة', color: 'var(--c-faith)' },
  { id: 'health', name: 'الصحة', color: 'var(--c-health)' },
  { id: 'work', name: 'المهام', color: 'var(--c-work)' },
]
const pct = (r) => (r === null || r === undefined ? '—' : `${num(Math.round(r * 100))}٪`)
const rateOf = (h) => h.rate30 ?? h.rate7

// "أ، ب و ج"
function join(names) {
  if (names.length <= 1) return names.join('')
  return names.join(' و')
}
const short = (h) => h.name.replace(/^صلاة /, '')

function tag(r) {
  if (r === null || r === undefined) return null
  if (r >= 0.8) return { cls: 'strong', label: 'مركز فيها' }
  if (r < 0.5) return { cls: 'weak', label: 'مقصّر' }
  return { cls: 'mid', label: 'نص نص' }
}

// جملة تلخص الركن: مركز في إيه ومقصّر في إيه
function sayFor(list) {
  const rated = list.filter((h) => h.days >= 3 && rateOf(h) !== null)
  if (rated.length === 0) return 'لسه بدري، كمّل تسجيل كام يوم والتقرير هيوضح.'
  const strong = rated.filter((h) => rateOf(h) >= 0.8).map(short)
  const weak = rated
    .filter((h) => rateOf(h) < 0.5)
    .sort((a, b) => rateOf(a) - rateOf(b))
    .map(short)
  if (strong.length && weak.length) return `مركز في ${join(strong.slice(0, 3))}، ومقصّر في ${join(weak.slice(0, 3))}.`
  if (weak.length) return `محتاج تشد في ${join(weak.slice(0, 3))}.`
  if (strong.length === rated.length) return 'ما شاء الله، ماشي كويس في كل حاجة هنا. ثبّت.'
  const low = [...rated].sort((a, b) => rateOf(a) - rateOf(b))[0]
  return `${strong.length ? `كويس في ${join(strong.slice(0, 3))}، و` : ''}أضعف حاجة ${short(low)} (${pct(rateOf(low))}).`
}

// في الصلاة: أنهي صلاة بتتأخر أو بتتقضي أكتر، وأنهي في المسجد
function prayerQuality(checks, today) {
  const from = dateKey(addDays(fromKey(today), -30))
  const per = Object.fromEntries(PRAYERS.map((p) => [p.id, { late: 0, qada: 0, mosque: 0, n: 0 }]))
  for (const c of checks) {
    if (!c.item.startsWith('prayer:') || c.date < from || c.date.length !== 10) continue
    const id = c.item.slice(7)
    if (!per[id]) continue
    per[id].n++
    if (c.value === 'late') per[id].late++
    if (c.value === 'qada') per[id].qada++
    if (c.value === 'mosque') per[id].mosque++
  }
  const out = []
  const name = (id) => PRAYERS.find((p) => p.id === id).name
  const lateMost = PRAYERS.map((p) => [p.id, per[p.id].late + per[p.id].qada]).sort((a, b) => b[1] - a[1])[0]
  if (lateMost && lateMost[1] >= 3) out.push(`${name(lateMost[0])} أكتر صلاة بتأخرها أو بتقضيها (${num(lateMost[1])} مرة في الشهر).`)
  const mosque = PRAYERS.filter((p) => per[p.id].n >= 5 && per[p.id].mosque / per[p.id].n >= 0.5).map((p) => p.name)
  if (mosque.length) out.push(`بتصلي ${join(mosque)} في المسجد غالبًا.`)
  return out
}

export default function BalanceReport({ habits, checks, balance }) {
  const today = todayKey()
  const mk = monthKey(new Date())
  const money = useLiveQuery(async () => {
    const [txns, obligations] = await Promise.all([db.txns.toArray(), db.obligations.toArray()])
    if (!txns.length && !obligations.length) return null
    const flow = monthFlow(mk, txns)
    const obls = obligationsFor(mk, obligations, txns)
    const dueNow = obls.filter((o) => o.due <= today)
    const saved = txns
      .filter((t) => t.date?.startsWith(mk))
      .reduce((s, t) => s + (t.type === 'toEnvelope' ? Number(t.amount) : t.type === 'fromEnvelope' ? -Number(t.amount) : 0), 0)
    return { flow, obls, dueNow, paidDue: dueNow.filter((o) => o.paid).length, saved }
  }, [mk, today])

  // الأضعف بيتفتح لوحده
  const rated = ASPECTS.filter((a) => balance[a.id].r7 !== null)
  const weakest = rated.length ? rated.reduce((m, a) => ((balance[a.id].r30 ?? balance[a.id].r7) < (balance[m.id].r30 ?? balance[m.id].r7) ? a : m)) : null

  return (
    <section className="card">
      <h2>توازني بالتفصيل</h2>
      <ul className="bars">
        {ASPECTS.map((a) => (
          <li key={a.id}>
            <div className="row-between">
              <span>
                <span className="swatch" style={{ background: a.color }} /> {a.name}
              </span>
              <span className="muted">
                ٧ أيام {pct(balance[a.id].r7)}، ٣٠ يوم {pct(balance[a.id].r30)}
              </span>
            </div>
            <span className="bar" style={{ '--bar': a.color }}>
              <span style={{ width: `${(balance[a.id].r7 || 0) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>

      {ASPECTS.map((a) => {
        const list = habits.filter((h) => h.aspect === a.id)
        if (!list.length) return null
        const groups = {}
        for (const h of list) (groups[h.group] ||= []).push(h)
        const extra = []
        if (a.id === 'faith') {
          const am = list.find((h) => h.id === 'adhkar:morning')
          const pm = list.find((h) => h.id === 'adhkar:evening')
          if (am && pm && rateOf(am) !== null && rateOf(pm) !== null && Math.abs(rateOf(am) - rateOf(pm)) >= 0.25) {
            extra.push(rateOf(am) > rateOf(pm) ? 'أذكار الصباح ماشية أحسن من المساء بكتير.' : 'أذكار المساء ماشية أحسن من الصباح بكتير.')
          }
          extra.push(...prayerQuality(checks, today))
        }
        return (
          <details key={a.id} className="bal-group" open={weakest?.id === a.id}>
            <summary className="bal-head">
              <h3 style={{ color: a.color }}>{a.name}</h3>
              <span className="muted">{pct(balance[a.id].r30 ?? balance[a.id].r7)}</span>
            </summary>
            <p className="bal-say">
              {sayFor(list)}
              {extra.map((x, i) => (
                <span key={i}> {x}</span>
              ))}
            </p>
            {Object.entries(groups).map(([g, hs]) => (
              <div key={g}>
                {Object.keys(groups).length > 1 && <span className="tasks-label">{g}</span>}
                {hs.map((h) => {
                  const t = tag(h.days >= 3 ? rateOf(h) : null)
                  const trend = h.rate7 !== null && h.rate30 !== null ? h.rate7 - h.rate30 : 0
                  return (
                    <div key={h.id} className="bal-item">
                      <span>
                        {h.name}
                        {trend >= 0.15 && <span className="pos"> ↑</span>}
                        {trend <= -0.15 && <span className="neg"> ↓</span>}
                      </span>
                      <span className="rate">
                        {pct(h.rate7)} / {pct(h.rate30)}
                      </span>
                      {t ? <span className={`bal-tag ${t.cls}`}>{t.label}</span> : <span className="bal-tag">جديد</span>}
                    </div>
                  )
                })}
              </div>
            ))}
            <p className="muted">النسبة: آخر ٧ أيام / آخر ٣٠ يوم. السهم ↑ يعني الأسبوع ده أحسن من الشهر.</p>
          </details>
        )
      })}

      <details className="bal-group">
        <summary className="bal-head">
          <h3 style={{ color: 'var(--c-money)' }}>الفلوس</h3>
          <span className="muted">الشهر ده</span>
        </summary>
        {!money ? (
          <p className="bal-say">سجّل حركاتك في المحفظة والتقرير هيوضحلك ماشي إزاي.</p>
        ) : (
          <p className="bal-say">
            دخلك {egp(money.flow.income)} وصرفت {egp(money.flow.expense)}
            {money.flow.income >= money.flow.expense
              ? `، فاضل معاك ${egp(money.flow.income - money.flow.expense)}.`
              : `، يعني صرفت أكتر من اللي دخل بـ ${egp(money.flow.expense - money.flow.income)}.`}
            {money.flow.byCat[0] && ` أكتر بند: ${money.flow.byCat[0][0]} (${egp(money.flow.byCat[0][1])}).`}
            {money.dueNow.length > 0 && ` دفعت ${num(money.paidDue)} من ${num(money.dueNow.length)} التزامات جه معادها.`}
            {money.saved > 0 ? ` حوّشت ${egp(money.saved)} في الأظرف.` : ' لسه ما حوّشتش في الأظرف الشهر ده.'}
          </p>
        )}
      </details>
    </section>
  )
}
