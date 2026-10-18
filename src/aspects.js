// جوانب الحياة اللي التطبيق بيوازن بينها، بالترتيب اللي هتتبني بيه
export const ASPECTS = [
  {
    id: 'faith',
    name: 'العبادة',
    color: 'var(--c-faith)',
    icon: 'moon',
    items: ['مواقيت الصلاة وعلامة ✓ لكل فرض', 'ورد يومي: جزء قراءة', 'حفظ ٣ آيات يوميًا مع مراجعة'],
    eta: 'التحديث الجاي',
  },
  {
    id: 'health',
    name: 'الصحة',
    color: 'var(--c-health)',
    icon: 'heart',
    items: ['غسيل الأسنان الصبح وقبل النوم', 'الوجبات التلاتة والمية', 'أكلت صحي ولا لأ'],
    eta: 'بعد العبادة',
  },
  {
    id: 'money',
    name: 'الفلوس',
    color: 'var(--c-money)',
    icon: 'wallet',
    items: ['المصاريف بالتصنيف', 'الأظرف كاش أو دهب'],
    eta: 'بعد الصحة',
  },
  {
    id: 'family',
    name: 'المواعيد',
    color: 'var(--c-family)',
    icon: 'calendar',
    items: ['أعياد الميلاد', 'مواعيد المدرسة', 'مواعيد التطعيمات'],
    eta: 'بعد الفلوس',
  },
  {
    id: 'goals',
    name: 'الأهداف',
    color: 'var(--c-goals)',
    icon: 'flag',
    items: ['شهادة Goethe للألماني', 'شهادة IELTS للإنجليزي', 'منحة DW'],
    eta: 'بعد المواعيد',
  },
]
