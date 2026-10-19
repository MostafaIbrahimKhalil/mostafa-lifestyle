// رسومات "تقدّمي": الدايرة على الفترة، ويوم بيوم، والصلاة، والقرآن، والمية، والجيم، والفلوس
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import BalanceRing from './BalanceRing.jsx'
import { CatBars, DayBars, StackRows } from './Charts.jsx'
import { db, setSetting } from '../db.js'
import { num, todayKey } from '../lib/dates.js'
import { ASPECTS } from '../aspects.js'
import {
  CHART_ASPECTS,
  PRAYER_KINDS,
  dailyScores,
  gymDays,
  periodAverage,
  prayerBreakdown,
  quranDays,
  spendByCategory,
  spendDays,
  waterDays,
} from '../lib/charts.js'
import { egp } from '../lib/wallet.js'

const P = (v) => `${num(Math.round(v * 100))}٪`
const short = (v) => (v >= 1000 ? `${num(Math.round(v / 100) / 10)} ألف` : num(Math.round(v)))
const sum = (rows) => rows.reduce((s, r) => s + (r.v || 0), 0)

const PRAYER_COLORS = {
  mosque: 'var(--c-faith)',
  ontime: 'color-mix(in srgb, var(--c-faith) 50%, var(--surface))',
  late: 'var(--c-money)',
  qada: 'var(--c-health)',
  missed: 'var(--surface-2)',
}

export default function ProgressCharts({ settings, checks, tasks }) {
  const today = todayKey()
  const n = settings.chartPeriod === 30 ? 30 : 7
  const [aspect, setAspect] = useState('overall')
  const [gymMeasure, setGymMeasure] = useState('kcal')
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const txns = useLiveQuery(() => db.txns.toArray(), [])

  const d = useMemo(() => {
    const both = dailyScores(checks, tasks, settings, today, n * 2)
    const prev = both.slice(0, n)
    const days = both.slice(n)
    return {
      days,
      avg: periodAverage(days),
      prevAvg: periodAverage(prev),
      prayers: prayerBreakdown(checks, settings, today, n),
      water: waterDays(checks, today, n),
      quran: quranDays(checks, today, n),
    }
  }, [checks, tasks, settings, today, n])

  const live = ASPECTS.filter((a) => CHART_ASPECTS.includes(a.id) || a.soon)
  const ringProgress = Object.fromEntries(CHART_ASPECTS.map((a) => [a, d.avg[a] ?? 0]))
  const label = n === 7 ? 'آخر ٧ أيام' : 'آخر ٣٠ يوم'
  const prevLabel = n === 7 ? 'الأسبوع اللي قبله' : 'الشهر اللي قبله'
  const aspectColor = aspect === 'overall' ? 'var(--brand)' : ASPECTS.find((a) => a.id === aspect).color

  const gym = workouts ? gymDays(workouts, today, n, gymMeasure) : null
  const spend = txns ? spendDays(txns, today, n) : null
  const cats = txns ? spendByCategory(txns, today, n) : []
  const waterAvg = (() => {
    const v = d.water.filter((r) => !r.isToday && r.v)
    return v.length ? sum(v) / v.length : 0
  })()
  const quranMin = sum(d.quran)
  const wirdDone = d.quran.filter((r) => r.good).length

  return (
    <>
      <div className="seg period-seg" role="tablist" aria-label="الفترة">
        {[
          [7, 'أسبوع'],
          [30, 'شهر'],
        ].map(([v, t]) => (
          <button key={v} className={n === v ? 'is-on' : ''} onClick={() => setSetting('chartPeriod', v)}>
            {t}
          </button>
        ))}
      </div>

      <section className="card balance">
        <div className="row-between">
          <h2>ميزانك</h2>
          <span className="muted small">{label}</span>
        </div>
        <div className="balance-row">
          <BalanceRing
            aspects={live}
            progress={ringProgress}
            centerValue={d.avg.overall === null ? '—' : P(d.avg.overall)}
            centerLabel={n === 7 ? 'الأسبوع' : 'الشهر'}
          />
          <ul className="legend legend-col">
            {live.map((a) => {
              const v = d.avg[a.id]
              const pv = d.prevAvg[a.id]
              const diff = v !== null && v !== undefined && pv !== null && pv !== undefined ? Math.round((v - pv) * 100) : null
              return (
                <li key={a.id} className={a.soon ? 'is-soon' : ''}>
                  <span className="swatch" style={{ background: a.color }} />
                  <span>{a.name}</span>
                  <span className="legend-val">
                    {a.soon ? 'قريبًا' : v === null || v === undefined ? '—' : P(v)}
                    {diff ? <small className={diff > 0 ? 'pos' : 'neg'}> {diff > 0 ? '↑' : '↓'}{num(Math.abs(diff))}</small> : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="muted small">
          متوسط الأيام اللي خلصت (النهارده لسه شغال). السهم مقارنة بـ{prevLabel}.
        </p>
      </section>

      <section className="card chart-card">
        <div className="row-between">
          <h2>يوم بيوم</h2>
          <span className="muted small">{label}</span>
        </div>
        <div className="chip-wrap chart-chips">
          {[['overall', 'الكل'], ...ASPECTS.filter((a) => CHART_ASPECTS.includes(a.id)).map((a) => [a.id, a.name])].map(([id, t]) => (
            <button key={id} className={`chip ${aspect === id ? 'chip-on' : ''}`} onClick={() => setAspect(id)}>
              {id !== 'overall' && <span className="swatch" style={{ background: ASPECTS.find((a) => a.id === id).color }} />}
              {t}
            </button>
          ))}
        </div>
        <DayBars
          data={d.days.map((r) => ({ ...r, v: r[aspect] }))}
          color={aspectColor}
          max={1}
          fmt={(v) => P(v)}
          note="نسبة الالتزام كل يوم"
        />
      </section>

      <section className="card chart-card">
        <div className="row-between">
          <h2>صلواتي</h2>
          <span className="muted small">{label}</span>
        </div>
        <StackRows rows={d.prayers} kinds={PRAYER_KINDS.map((k) => ({ ...k, color: PRAYER_COLORS[k.id] }))} />
        <p className="muted small">الرقم على الشمال: في وقتها أو في المسجد.</p>
      </section>

      <section className="card chart-card">
        <div className="row-between">
          <h2>القرآن</h2>
          <span className="muted small">
            {num(quranMin)} دقيقة، الورد خلص {num(wirdDone)} من {num(n)}
          </span>
        </div>
        <DayBars
          data={d.quran}
          color="var(--c-faith)"
          readout={(r) => `${num(r.v)} دقيقة${r.good ? '، خلّصت الورد ✓' : r.pct ? `، قريت ${num(r.pct)}٪` : ''}`}
          note="دقايق القراية كل يوم"
          emptyText="الدقايق بتتحسب لوحدها لما تفتح الورد وتقرا."
        />
        <p className="muted small">العمود الباهت = يوم ما خلّصتش فيه الورد.</p>
      </section>

      <section className="card chart-card">
        <div className="row-between">
          <h2>المية</h2>
          <span className="muted small">متوسط {num(Math.round(waterAvg * 10) / 10)} كوباية</span>
        </div>
        <DayBars
          data={d.water}
          color="var(--c-work)"
          target={d.water[0]?.target}
          readout={(r) => `${num(r.v)} من ${num(r.target)} كوباية`}
          note="كوبايات المية كل يوم"
        />
        <p className="muted small">الخط = الهدف ١٢ كوباية، والعمود الباهت = ما وصلتش له.</p>
      </section>

      {gym && (
        <section className="card chart-card">
          <div className="row-between">
            <h2>الجيم</h2>
            <div className="seg seg-small">
              {[
                ['kcal', 'سعرات'],
                ['min', 'دقايق'],
              ].map(([v, t]) => (
                <button key={v} className={gymMeasure === v ? 'is-on' : ''} onClick={() => setGymMeasure(v)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <DayBars
            data={gym}
            color="var(--c-health)"
            readout={(r) =>
              r.kcal || r.min || r.strength
                ? `${num(r.min)} دقيقة كارديو، ${num(r.kcal)} سعر${r.strength ? '، ومقاومة ✓' : ''}`
                : 'ما اتسجلش'
            }
            fmt={(v, tick) => (tick ? short(v) : num(v))}
            note={gymMeasure === 'kcal' ? 'سعرات الكارديو كل يوم' : 'دقايق الكارديو كل يوم'}
            emptyText="سجّل الكارديو من صفحة الجيم وهيظهر هنا."
          />
          <p className="muted small">
            المجموع: {num(sum(gym.map((r) => ({ v: r.min }))))} دقيقة، {num(sum(gym.map((r) => ({ v: r.kcal }))))} سعر،{' '}
            {num(gym.filter((r) => r.strength).length)} مرة مقاومة. أرقام الجهاز بتزوّد السعرات، فخد الدقايق أساس.
          </p>
        </section>
      )}

      {spend && (
        <section className="card chart-card">
          <div className="row-between">
            <h2>مصاريفي</h2>
            <span className="muted small">{egp(sum(spend))}</span>
          </div>
          <DayBars
            data={spend}
            color="var(--c-money)"
            fmt={(v, tick) => (tick ? short(v) : egp(v))}
            note="المصروف كل يوم"
            emptyText="سجّل مصاريفك في المحفظة وهتظهر هنا."
          />
          {cats.length > 0 && (
            <>
              <span className="tasks-label">رايحة فين</span>
              <CatBars items={cats} color="var(--c-money)" fmt={egp} />
            </>
          )}
        </section>
      )}
    </>
  )
}
