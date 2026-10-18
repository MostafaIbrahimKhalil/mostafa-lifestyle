import Icon from '../components/Icon.jsx'

const ITEMS = [
  { id: 'plan', label: 'خطتي: أكتوبر ونوفمبر', sub: 'الضروري، والأسبوع ده، والأسابيع لحد ديسمبر', icon: 'flag' },
  { id: 'posts', label: 'جدول النشر', sub: 'الفيديوهات بمواعيدها: اتعدّل، اتجدول، نزل', icon: 'calendar' },
  { id: 'baby', label: 'البيت والمولود', sub: 'التطعيمات والدكاترة والمشتريات', icon: 'heart' },
  { id: 'work', label: 'شغلي وحساباتي', sub: 'الطلبات، اللي سلّمته، الفلوس وعند مين', icon: 'wallet' },
  { id: 'hifz', label: 'حفظ القرآن', sub: 'حفظ ٣ آيات، مواعيد التسميع والمراجعة', icon: 'book' },
  { id: 'tasbih', label: 'السبحة', sub: 'عدّاد تسبيح حر', icon: 'beads' },
  { id: 'gym', label: 'جدول التمرين', sub: 'الأيام والمعاد والتمارين', icon: 'dumbbell' },
  { id: 'month', label: 'الشهر', sub: 'التقويم والتزامك ومهام كل شهر', icon: 'month' },
  { id: 'year', label: 'السنة', sub: 'التزامك شهر بشهر', icon: 'star' },
  { id: 'settings', label: 'الإعدادات', sub: 'المكان، النوم، الورد، النسخة الاحتياطية', icon: 'gear' },
]

export default function More({ onOpen }) {
  return (
    <>
      <header className="page-head">
        <h1>المزيد</h1>
      </header>
      <ul className="more-list card">
        {ITEMS.map((it) => (
          <li key={it.id}>
            <button className="more-item" onClick={() => onOpen(it.id)}>
              <span className="card-icon">
                <Icon name={it.icon} />
              </span>
              <span className="tl-text">
                <strong>{it.label}</strong>
                <small>{it.sub}</small>
              </span>
              <Icon name="chevronLeft" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
