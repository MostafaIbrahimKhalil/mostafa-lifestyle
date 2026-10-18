# مصطفى لايف استايل

تطبيق شخصي (PWA) لتوازن اليوم: العبادة، الصحة، الفلوس، المواعيد، والأهداف.

- البيانات محفوظة على الموبايل بس (IndexedDB) — مفيش أي بيانات شخصية في الكود ده.
- بيتنشر تلقائي على GitHub Pages مع كل تحديث على `main`.
- التثبيت على الآيفون: افتح الرابط من Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية.

## التشغيل محليًا

```
npm install
npm run dev
```

## المصادر
- نص القرآن: [quran-json](https://github.com/risan/quran-json) — الرسم العثماني من [موسوعة القرآن الكريم](https://quranenc.com) (CC BY-SA 4.0).
- الأجزاء والصفحات: [quran-meta](https://github.com/quran-center/quran-meta) (MIT).
- أذكار الصباح والمساء: [Morning-And-Evening-Adhkar-DB](https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB) (MIT)، وأذكار النوم: [Adhkar-json](https://github.com/rn0x/Adhkar-json) — من حصن المسلم، مع تصحيحات تشكيل موضحة في `scripts/build-adhkar-data.py`.
- مواقيت الصلاة: [adhan-js](https://github.com/batoulapps/adhan-js) (MIT).
- خط المصحف: Amiri Quran (OFL).
