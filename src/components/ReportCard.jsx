import { useState } from 'react'
import Icon from './Icon.jsx'
import { buildReport } from '../lib/report.js'

// تقرير الأسبوع/الشهر: نص تنسخه وتبعته لكلود
export default function ReportCard({ settings }) {
  const [text, setText] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function open(kind) {
    setBusy(true)
    try {
      setText(await buildReport(kind, settings))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.querySelector('.report-text')
      ta?.select()
      document.execCommand?.('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <section className="card report-card">
        <div className="row-between">
          <span>
            <strong>التقرير</strong>
            <small className="muted">انسخه وابعتهولي أقيّم الصورة ككل</small>
          </span>
        </div>
        <div className="row">
          <button className="btn" onClick={() => open('week')} disabled={busy}>
            تقرير الأسبوع
          </button>
          <button className="btn btn-ghost" onClick={() => open('month')} disabled={busy}>
            تقرير الشهر
          </button>
        </div>
      </section>
      {text && (
        <div className="reader" role="dialog" aria-label="التقرير">
          <header className="reader-bar">
            <button className="icon-btn" onClick={() => setText(null)} aria-label="رجوع">
              <Icon name="chevronRight" />
            </button>
            <div className="reader-title">
              <strong>{text.split('\n')[0].split(' — ')[0]}</strong>
              <small>انسخه والصقه في الشات مع كلود</small>
            </div>
            <span style={{ width: 40 }} />
          </header>
          <div className="reader-body">
            <textarea className="report-text" readOnly value={text} />
            <div className="row">
              <button className="btn" onClick={copy}>
                {copied ? 'اتنسخ ✓' : 'انسخ التقرير'}
              </button>
              {navigator.share && (
                <button className="btn btn-ghost" onClick={() => navigator.share({ text }).catch(() => {})}>
                  <Icon name="share" size={18} /> شارك
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
