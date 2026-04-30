import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="/" className="footer-logo">
            <div className="nav-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="nav-logo-text">PADI</span>
          </a>
          <p>Your AI study partner. Built by students for students.</p>
          <p className="footer-syca">A product of <strong>Syca Works Ltd</strong></p>
        </div>

        <div className="footer-col">
          <div className="footer-col-title">Product</div>
          <ul className="footer-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#waitlist">Join waitlist</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <div className="footer-col-title">Support</div>
          <ul className="footer-links">
            <li><a href="mailto:support@yourpadi.com">support@yourpadi.com</a></li>
            <li><a href="https://wa.me/234000000000" target="_blank" rel="noreferrer">WhatsApp support</a></li>
            <li><a href="#faq">FAQs</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <div className="footer-col-title">Legal</div>
          <ul className="footer-links">
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/refund">Refund Policy</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-left">
          © {new Date().getFullYear()} Syca Works Ltd. All rights reserved. · yourpadi.com
        </div>
        <div className="footer-socials">
          <a href="https://x.com/yourpadi" target="_blank" rel="noreferrer" className="footer-social-link" title="X / Twitter">𝕏</a>
          <a href="https://instagram.com/yourpadi" target="_blank" rel="noreferrer" className="footer-social-link" title="Instagram">▣</a>
          <a href="https://wa.me/234000000000" target="_blank" rel="noreferrer" className="footer-social-link" title="WhatsApp">◎</a>
        </div>
      </div>
    </footer>
  )
}
