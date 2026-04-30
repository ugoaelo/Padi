import { useState, useEffect } from 'react'
import './PWAInstallPrompt.css'

export default function PWAInstallPrompt() {
  const [prompt,  setPrompt]  = useState(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('padi_pwa_dismissed')) return

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      // Show after 30s of usage — not immediately
      setTimeout(() => setVisible(true), 30000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    localStorage.setItem('padi_pwa_dismissed', '1')
  }

  if (!visible || dismissed) return null

  return (
    <div className="pwa-prompt">
      <div className="pwa-prompt-icon">
        <div className="pwa-logo-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>
      <div className="pwa-prompt-text">
        <div className="pwa-prompt-title">Add Padi to your home screen</div>
        <div className="pwa-prompt-sub">Study offline, faster access, no browser bar</div>
      </div>
      <div className="pwa-prompt-actions">
        <button className="pwa-install-btn" onClick={handleInstall}>Install</button>
        <button className="pwa-dismiss-btn" onClick={handleDismiss}>×</button>
      </div>
    </div>
  )
}
