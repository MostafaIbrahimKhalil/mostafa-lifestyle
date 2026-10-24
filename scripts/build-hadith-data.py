"""بيبني ملفات الأحاديث اللي التطبيق بيقرا منها (public/data/hadith/*.json) — بيتشغّل مرة واحدة بس.

المصدر: AhmedBaset/hadith-json (ISC) — منقول من Sunnah.com
  db/by_book/other_books/riyad_assalihin.json  ← رياض الصالحين (١٨٩٦ حديث)
  db/by_book/forties/nawawi40.json              ← الأربعون النووية (٤٢ حديث)

الاستخدام: python3 scripts/build-hadith-data.py <مجلد db/by_book> <مجلد الإخراج>
النص العربي بيتنقل زي ما هو؛ التنظيف بس: علامات الاتجاه المخفية والمسافات الزيادة.
"""

import json
import os
import re
import sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def clean(t):
    t = re.sub('[‎‏‪-‮﻿]', '', t)
    t = t.replace('((', '(').replace('))', ')')
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\s*\n\s*', '\n', t)
    return t.strip()


def chapter_title(t):
    return re.sub(r'ـ+', '', clean(t))


def build(path, key):
    d = json.load(open(path, encoding='utf-8'))
    chapters = sorted(d['chapters'], key=lambda c: c['id'])
    out_chapters = []
    for c in chapters:
        hs = sorted((h for h in d['hadiths'] if h['chapterId'] == c['id']), key=lambda h: h['id'])
        out_chapters.append({'title': chapter_title(c['arabic']), 'hadiths': [clean(h['arabic']) for h in hs]})
    book = {
        'id': key,
        'title': d['metadata']['arabic']['title'],
        'author': d['metadata']['arabic']['author'],
        'count': sum(len(c['hadiths']) for c in out_chapters),
        'chapters': out_chapters,
    }
    with open(os.path.join(out, f'{key}.json'), 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False, separators=(',', ':'))
    print(key, book['count'], 'حديث،', len(out_chapters), 'كتاب')


build(os.path.join(src, 'forties/nawawi40.json'), 'nawawi')
build(os.path.join(src, 'other_books/riyad_assalihin.json'), 'riyad')
