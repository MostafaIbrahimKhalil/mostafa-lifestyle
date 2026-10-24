// مكتبة الأحاديث: الأربعون النووية ورياض الصالحين — تصفّح بالكتاب، وبحث، ومفضلة
import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { setSetting } from '../db.js'
import { num } from '../lib/dates.js'
import { BOOKS, favKey, flatten, loadBook, search } from '../lib/hadith.js'

export default function Hadith({ settings }) {
  const [bookId, setBookId] = useState(settings.hadithBook || 'riyad')
  const [book, setBook] = useState(null)
  const [err, setErr] = useState(null)
  const [chapter, setChapter] = useState(null)
  const [q, setQ] = useState('')
  const [showFav, setShowFav] = useState(false)
  const favs = settings.hadithFav || []

  useEffect(() => {
    setBook(null)
    setChapter(null)
    setErr(null)
    loadBook(bookId).then(setBook).catch((e) => setErr(e.message))
  }, [bookId])

  const results = useMemo(() => (book && q.trim().length >= 2 ? search(book, q.trim()) : null), [book, q])

  function pickBook(id) {
    setBookId(id)
    setSetting('hadithBook', id)
  }
  const toggleFav = (h) => {
    const k = favKey(bookId, h)
    setSetting('hadithFav', favs.includes(k) ? favs.filter((x) => x !== k) : [...favs, k])
  }

  const list = !book
    ? []
    : results
      ? results
      : showFav
        ? flatten(book).filter((h) => favs.includes(favKey(bookId, h)))
        : chapter !== null
          ? flatten(book).filter((h) => h.ci === chapter)
          : null

  return (
    <>
      <header className="page-head">
        <h1>الأحاديث</h1>
        <p className="muted">{book ? `${book.title} — ${book.author}، ${num(book.count)} حديث` : 'بيفتح…'}</p>
      </header>

      <div className="seg" role="tablist">
        {BOOKS.map((b) => (
          <button key={b.id} className={bookId === b.id ? 'is-on' : ''} onClick={() => pickBook(b.id)}>
            {b.title}
          </button>
        ))}
      </div>

      <div className="row">
        <input className="input" placeholder="دوّر في الأحاديث… (مثلًا: الصبر، الجار، الأم)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`chip ${showFav ? 'chip-on' : ''}`} onClick={() => (setShowFav(!showFav), setChapter(null), setQ(''))}>
          <Icon name="star" size={15} /> المفضلة {favs.filter((k) => k.startsWith(`${bookId}:`)).length ? num(favs.filter((k) => k.startsWith(`${bookId}:`)).length) : ''}
        </button>
      </div>

      {err && <p className="late">{err}. اتأكد إن النت شغال أول مرة.</p>}

      {book && list === null && (
        <ul className="card more-list hadith-chapters">
          {book.chapters.map((c, i) =>
            c.hadiths.length ? (
              <li key={i}>
                <button className="more-item" onClick={() => setChapter(i)}>
                  <span className="tl-text">
                    <strong>{c.title}</strong>
                    <small>{num(c.hadiths.length)} حديث</small>
                  </span>
                  <Icon name="chevronLeft" size={18} />
                </button>
              </li>
            ) : null,
          )}
        </ul>
      )}

      {list && (
        <>
          {chapter !== null && !results && !showFav && (
            <button className="link-btn" onClick={() => setChapter(null)}>
              <Icon name="chevronRight" size={16} /> كل الكتب
            </button>
          )}
          {results && <p className="muted small">{results.length ? `${num(results.length)} نتيجة${results.length >= 60 ? ' (أول ٦٠)' : ''}` : 'مفيش نتايج'}</p>}
          {showFav && !list.length && <p className="muted">دوس ☆ على أي حديث عشان يتحفظ هنا.</p>}
          <ul className="hadith-list">
            {list.map((h) => (
              <HadithItem key={`${h.ci}-${h.hi}`} h={h} fav={favs.includes(favKey(bookId, h))} onFav={() => toggleFav(h)} showChapter={!!results || showFav} book={book.title} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export function HadithItem({ h, fav, onFav, showChapter, book }) {
  return (
    <li className="card hadith-item">
      <div className="row-between">
        <span className="pill">{num(h.n)}</span>
        <div className="row">
          <button
            className="icon-btn"
            aria-label="شارك"
            onClick={() => navigator.share?.({ text: `${h.text}\n\n— ${book}` }).catch(() => {}) ?? navigator.clipboard?.writeText(h.text)}
          >
            <Icon name="share" size={18} />
          </button>
          {onFav && (
            <button className={`icon-btn ${fav ? 'is-fav' : ''}`} aria-label={fav ? 'شيل من المفضلة' : 'ضيف للمفضلة'} aria-pressed={fav} onClick={onFav}>
              <Icon name="star" size={18} />
            </button>
          )}
        </div>
      </div>
      <p className="hadith-text">{h.text}</p>
      {showChapter && <small className="muted">{h.chapter}</small>}
    </li>
  )
}
