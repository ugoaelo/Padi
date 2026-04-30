import { useState } from 'react'
import './SupportWidget.css'

const SUPPORT_EMAIL    = 'support@yourpadi.com'
const SUPPORT_WHATSAPP = 'https://wa.me/2348000000000' // replace with real number

export default function SupportWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        className="support-fab"
        onClick={() => setOpen(!open)}
        title="Get support"
        aria-label="Open support"
      >
        {open ? '×' : '💬'}
      </button>

      {/* Popup */}
      {open && (
        <div className="support-popup">
          <div className="support-popup-header">
            <div className="support-popup-title">Need help?</div>
            <div className="support-popup-sub">We typically respond within a few hours.</div>
          </div>

          <div className="support-popup-options">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Padi Support Request`}
              className="support-option"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <div className="support-option-icon">✉️</div>
              <div className="support-option-text">
                <div className="support-option-title">Email support</div>
                <div className="support-option-sub">{SUPPORT_EMAIL}</div>
              </div>
              <span className="support-option-arrow">→</span>
            </a>

            <a
              href={SUPPORT_WHATSAPP}
              className="support-option support-option--wa"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <div className="support-option-icon">📱</div>
              <div className="support-option-text">
                <div className="support-option-title">WhatsApp support</div>
                <div className="support-option-sub">Chat with us directly</div>
              </div>
              <span className="support-option-arrow">→</span>
            </a>
          </div>

          <div className="support-popup-footer">
            🛡️ 48-hour refund policy · Cancel any time
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && <div className="support-backdrop" onClick={() => setOpen(false)} />}
    </>
  )
}
