// رسومات بسيطة بالـ SVG: أعمدة لكل يوم، وأشرطة مقسمة، وأشرطة للبنود
// الوقت ماشي من اليمين للشمال زي شريط الأيام: الأقدم يمين، والنهارده على الشمال
import { useState } from 'react'
import { formatShortDate, num } from '../lib/dates.js'
import { niceMax } from '../lib/charts.js'

export const WD = ['حد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت']

const W = 320
const H = 150
const TOP = 10
const BOTTOM = 22 // مكان أسماء الأيام
const GUT = 30 // مكان أرقام المحور على اليمين
const PLOT_H = H - TOP - BOTTOM

/**
 * data: [{ k, day, v (رقم أو null), isToday, good? }]
 * fmt(v) نص القيمة، max أعلى المحور، target خط الهدف
 */
export function DayBars({ data, color, fmt = (v) => num(v), max, target, ticks = 2, readout, note, emptyText }) {
  const [sel, setSel] = useState(null)
  const n = data.length
  const top = max ?? niceMax(Math.max(target || 0, ...data.map((d) => d.v || 0)))
  const plotW = W - GUT
  const slot = plotW / n
  const bw = Math.min(22, Math.max(4, slot * 0.62))
  // الأقدم (index 0) على اليمين
  const cx = (i) => plotW - (i + 0.5) * slot
  const y = (v) => TOP + PLOT_H - (Math.min(v, top) / top) * PLOT_H
  const base = TOP + PLOT_H
  const i0 = sel ?? n - 1
  const cur = data[i0]
  const hasAny = data.some((d) => d.v)

  const labelEvery = n <= 8 ? 1 : 7
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (top / ticks) * i)

  return (
    <div className="daybars">
      <p className="chart-readout">
        <span className="muted">{cur.isToday ? 'النهارده' : `${WD[cur.day.getDay()]} ${formatShortDate(cur.day)}`}</span>
        <strong>{cur.v === null || cur.v === undefined ? '—' : readout ? readout(cur) : fmt(cur.v)}</strong>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={note || 'رسمة لكل يوم'}>
        {tickVals.map((t) => (
          <g key={t}>
            <line x1="0" x2={plotW} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={W - 2} y={y(t) + 4} className="chart-tick" textAnchor="end">
              {fmt(t, true)}
            </text>
          </g>
        ))}
        {target ? (
          <g>
            <line x1="0" x2={plotW} y1={y(target)} y2={y(target)} className="chart-target" />
          </g>
        ) : null}
        {data.map((d, i) => {
          if (d.v === null || d.v === undefined) return null
          const h = base - y(d.v)
          const x = cx(i) - bw / 2
          const r = Math.min(4, bw / 2, h)
          const op = d.isToday ? 0.45 : d.good === false ? 0.55 : 1
          return h > 0 ? (
            <path
              key={d.k}
              d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + bw - r} Q${x + bw},${base - h} ${x + bw},${base - h + r} V${base} Z`}
              fill={color}
              fillOpacity={op}
              className={i === i0 ? 'is-sel' : ''}
            />
          ) : (
            <line key={d.k} x1={x} x2={x + bw} y1={base - 1} y2={base - 1} stroke={color} strokeOpacity="0.5" strokeWidth="2" />
          )
        })}
        {/* علامة اليوم المختار */}
        <line x1={cx(i0)} x2={cx(i0)} y1={TOP} y2={base} className="chart-cursor" />
        {data.map((d, i) =>
          (n - 1 - i) % labelEvery === 0 ? (
            <text key={d.k} x={cx(i)} y={H - 6} className={`chart-x ${i === i0 ? 'is-sel' : ''}`} textAnchor="middle">
              {n <= 8 ? (d.isToday ? 'النهارده' : WD[d.day.getDay()]) : num(d.day.getDate())}
            </text>
          ) : null,
        )}
        {/* أماكن اللمس أكبر من العمود */}
        {data.map((d, i) => (
          <rect
            key={d.k}
            x={cx(i) - slot / 2}
            y="0"
            width={slot}
            height={H}
            fill="transparent"
            onPointerDown={() => setSel(i)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(i)}
          />
        ))}
      </svg>
      {!hasAny && emptyText && <p className="chart-empty muted small">{emptyText}</p>}
    </div>
  )
}

/** صفوف، وكل صف شريط مقسم لأجزاء. kinds: [{id, name, color}] */
export function StackRows({ rows, kinds }) {
  return (
    <div className="stack-rows">
      {rows.map((r) => (
        <div key={r.id} className="stack-row">
          <span className="stack-name">{r.name}</span>
          <span className="stack-bar" role="img" aria-label={`${r.name}: ${kinds.map((k) => `${k.name} ${r[k.id] || 0}`).join('، ')}`}>
            {r.total ? (
              kinds.map((k) =>
                r[k.id] ? <span key={k.id} style={{ flexGrow: r[k.id], background: k.color }} title={`${k.name}: ${r[k.id]}`} /> : null,
              )
            ) : (
              <span className="stack-empty" />
            )}
          </span>
          <span className="stack-val">{r.total ? `${num(Math.round(((r.mosque + r.ontime) / r.total) * 100))}٪` : '—'}</span>
        </div>
      ))}
      <ul className="chart-legend">
        {kinds.map((k) => (
          <li key={k.id}>
            <span className="swatch" style={{ background: k.color }} />
            {k.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** أشرطة أفقية مرتبة: [{name, v}] */
export function CatBars({ items, color, fmt = (v) => num(v), limit = 6 }) {
  const top = items.slice(0, limit)
  const rest = items.slice(limit).reduce((s, x) => s + x.v, 0)
  const list = rest ? [...top, { name: 'الباقي', v: rest }] : top
  const max = Math.max(1, ...list.map((x) => x.v))
  return (
    <ul className="cat-bars">
      {list.map((x) => (
        <li key={x.name}>
          <span className="cat-name">{x.name}</span>
          <span className="cat-track">
            <span style={{ width: `${(x.v / max) * 100}%`, background: color }} />
          </span>
          <span className="cat-val">{fmt(x.v)}</span>
        </li>
      ))}
    </ul>
  )
}
