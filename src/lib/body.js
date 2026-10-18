// قياسات الجسم: متوسط الوزن كل أسبوع، والوسط، والـ InBody
import { addDays, dateKey, fromKey } from './dates.js'

const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)

export function bodyTrend(rows, today) {
  const withKg = rows.filter((r) => r.kg)
  const d0 = fromKey(today)
  const inWin = (r, a, b) => r.date > dateKey(addDays(d0, -a)) && r.date <= dateKey(addDays(d0, -b))
  const weekAvg = avg(withKg.filter((r) => inWin(r, 7, 0)).map((r) => r.kg))
  const prevWeekAvg = avg(withKg.filter((r) => inWin(r, 14, 7)).map((r) => r.kg))
  // متوسط كل أسبوع (آخر ١٢ أسبوع) للرسمة
  const weeks = []
  for (let i = 11; i >= 0; i--) {
    const ws = withKg.filter((r) => inWin(r, 7 * (i + 1), 7 * i))
    if (ws.length) weeks.push({ from: dateKey(addDays(d0, -7 * (i + 1) + 1)), avg: avg(ws.map((r) => r.kg)) })
  }
  const waists = rows.filter((r) => r.waist)
  const inbodies = rows.filter((r) => r.fat)
  const lastInbody = inbodies.at(-1)
  const prevInbody = inbodies.at(-2)
  return {
    first: withKg[0],
    weekAvg,
    prevWeekAvg,
    weeks,
    lastWaist: waists.at(-1),
    waistChange: waists.length >= 2 ? waists.at(-1).waist - waists[0].waist : 0,
    lastInbody,
    inbodyChange: lastInbody && prevInbody ? { fat: lastInbody.fat - prevInbody.fat, muscle: (lastInbody.muscle || 0) - (prevInbody.muscle || 0) } : null,
  }
}
