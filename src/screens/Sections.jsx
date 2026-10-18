import Icon from '../components/Icon.jsx'

export default function Sections({ aspects }) {
  return (
    <>
      <header className="page-head">
        <h1>الأقسام</h1>
        <p className="muted">كل قسم هيتفعّل في تحديث لوحده، بالترتيب ده.</p>
      </header>

      <div className="stack">
        {aspects.map((a, i) => (
          <article key={a.id} className="card section-card" style={{ '--accent': a.color }}>
            <div className="section-top">
              <span className="section-icon">
                <Icon name={a.icon} />
              </span>
              <div className="section-title">
                <h2>{a.name}</h2>
                <small>{a.eta}</small>
              </div>
              <span className="step-no">{(i + 1).toLocaleString('ar-EG')}</span>
            </div>
            <ul className="section-items">
              {a.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  )
}
