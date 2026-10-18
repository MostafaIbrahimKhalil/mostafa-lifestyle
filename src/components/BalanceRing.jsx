// دائرة "ميزان اليوم": كل جانب ليه قوس، والقوس بيتملى على قد اللي اتعمل فيه النهارده
const R = 54
const CIRC = 2 * Math.PI * R
const GAP = 7 // فاصل بين الأقواس بالبكسل

export default function BalanceRing({ aspects, progress = {}, centerLabel, centerValue }) {
  const n = aspects.length
  const seg = CIRC / n
  return (
    <svg viewBox="0 0 140 140" className="ring" role="img" aria-label="ميزان اليوم">
      <g transform="rotate(-90 70 70)">
        {aspects.map((a, i) => {
          const p = Math.max(0, Math.min(1, progress[a.id] ?? 0))
          const len = seg - GAP
          const offset = -i * seg
          return (
            <g key={a.id}>
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={a.color}
                strokeOpacity="0.18"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={offset}
              />
              {p > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${len * p} ${CIRC - len * p}`}
                  strokeDashoffset={offset}
                />
              )}
            </g>
          )
        })}
      </g>
      <text x="70" y="66" textAnchor="middle" className="ring-value">
        {centerValue}
      </text>
      <text x="70" y="86" textAnchor="middle" className="ring-label">
        {centerLabel}
      </text>
    </svg>
  )
}
