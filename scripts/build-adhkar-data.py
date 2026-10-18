"""بيبني ملف الأذكار اللي التطبيق بيقرا منه (src/data/adhkar.json) — بيتشغّل مرة واحدة بس.

المصادر (من كتاب حصن المسلم للقحطاني):
  أذكار الصباح والمساء: Seen-Arabic/Morning-And-Evening-Adhkar-DB (ar.json) — MIT
  أذكار النوم: rn0x/Adhkar-json (adhkar.json، فئة "أذكار النوم")

الاستخدام: python3 scripts/build-adhkar-data.py <ar.json> <adhkar.json>
النصوص بتتنقل زي ما هي، والتنظيف بس: شيل الأقواس (( )) اللي حوالين الذكر والمسافات الزيادة.
"""

import json
import re
import sys

morning_evening_path, hisn_path = sys.argv[1], sys.argv[2]


def clean(text):
    t = text.strip()
    if t.startswith('((') and t.endswith('))'):
        t = t[2:-2]
    elif t.startswith('((') and t.endswith(')).'):
        t = t[2:-3]
    t = re.sub(r'\s+', ' ', t).strip()
    return t


me = json.load(open(morning_evening_path, encoding='utf-8'))
morning, evening = [], []
for x in sorted(me, key=lambda x: x['order']):
    item = {
        'id': x['order'],
        'text': clean(x['content']),
        'count': int(x['count']),
        'countText': x.get('count_description') or '',
        'fadl': (x.get('fadl') or '').strip(),
        'source': (x.get('source') or '').strip(),
    }
    if x['type'] in (0, 1):
        morning.append(item)
    if x['type'] in (0, 2):
        evening.append(item)

hisn = json.load(open(hisn_path, encoding='utf-8'))
sleep_cat = next(c for c in hisn if c['category'] == 'أذكار النوم')
sleep = []
for x in sleep_cat['array']:
    item = {'id': x['id'], 'text': clean(x['text']), 'count': int(x['count']), 'countText': '', 'fadl': '', 'source': '', 'note': ''}
    t = x['text'].strip()
    # الذكر الأول فيه وصف للفعل جوه النص: بنفصل الوصف عن نص السور (من غير ما نغيّر ولا كلمة)
    m = re.match(r'^\(\((.*?):(.*﴾)\s*([^﴾]*?)\)\)\s*\((.*?)\)\.?$', t, re.S)
    if m:
        item['note'] = f"{m.group(1).strip()}، {m.group(3).strip()} — {m.group(4).strip()}"
        item['text'] = re.sub(r'\s+', ' ', m.group(2)).strip()
    # التسبيح ٣٣/٣٣/٣٤ = ١٠٠ — العدّاد يمشي لـ ١٠٠
    if 'ثلاثاً وثلاثين' in t:
        item['count'] = 100
        item['note'] = '٣٣ سبحان الله، ٣٣ الحمد لله، ٣٤ الله أكبر'
    sleep.append(item)

# ===== تصحيحات بعد المراجعة (مقارنة بنسختين تانيين من حصن المسلم) =====
# تشكيل غلط في المصدر — بنصلّحه هنا بشكل صريح عشان يبقى واضح إيه اللي اتغيّر
FIXES = {
    ('evening', 24): (
        'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ: '
        'فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا'
    ),
}
REPLACE = [
    ('morning', 7, 'الْملْكُ', 'الْمُلْكُ'),
    ('sleep', 2, 'عِنْـــــــــــدَهُ', 'عِنْدَهُ'),
]
lists = {'morning': morning, 'evening': evening, 'sleep': sleep}
for (name, i), text in FIXES.items():
    item = next(x for x in lists[name] if x['id'] == i)
    item['text'] = text
for name, i, old, new in REPLACE:
    item = next(x for x in lists[name] if x['id'] == i)
    if old not in item['text']:
        raise SystemExit(f'التصحيح مش لاقي النص: {name} {i} {old}')
    item['text'] = item['text'].replace(old, new)
# مسافة زيادة قبل الكسرة في «السَّجْدَة ِ»
for x in sleep:
    x['text'] = re.sub('ة \u0650', 'ة\u0650', x['text'])
# «نَبَيِّنَا» → «نَبِيِّنَا» (ترتيب الشدة والكسرة بيختلف في المصدر، فبنستخدم نمط)
for lst in (morning, evening):
    for x in lst:
        x['text'] = re.sub('نَبَي[\u0650\u0651]{2}نَا', 'نَبِيِّنَا', x['text'])
# مرجع الآية كان جوه النص اللي بيتقري — نقلناه للمصدر
for x in evening:
    m = re.search(r'\s*\.?\s*\[البقرة[^\]]*\]\s*$', x['text'])
    if m:
        x['source'] = (m.group(0).strip(' .') + ' — ' + x['source']).strip(' —')
        x['text'] = x['text'][: m.start()].rstrip(' .')
# «اللهم قني عذابك يوم تبعث عبادك» ثلاث مرات (أبو داود ٥٠٤٥ كما في حصن المسلم)
for x in sleep:
    if 'قِنِي عَذَابَكَ' in x['text']:
        x['count'] = 3
        x['note'] = 'ويضع يده اليمنى تحت خده — ثلاث مرات'

# ذكر زيادة طلبه مصطفى قبل النوم (أبو هريرة، ابن حبان ٥٥٢٨، وصححه الألباني في صحيح الترغيب)
sleep.append({
    'id': 14,
    'text': 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، '
            'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ، سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ',
    'count': 1,
    'countText': '',
    'fadl': 'غُفِرَتْ لَهُ ذُنُوبُهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ',
    'source': 'عن أبي هريرة رضي الله عنه — ابن حبان (٥٥٢٨)، وصححه الألباني في صحيح الترغيب',
    'note': 'حين تأوي إلى فراشك',
})

out = {
    'sources': {
        'morning_evening': 'Seen-Arabic/Morning-And-Evening-Adhkar-DB (MIT) — حصن المسلم',
        'sleep': 'rn0x/Adhkar-json — حصن المسلم للقحطاني',
    },
    'morning': morning,
    'evening': evening,
    'sleep': sleep,
}
json.dump(out, open('src/data/adhkar.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(f'تمام: الصباح {len(morning)}، المساء {len(evening)}، النوم {len(sleep)}')
