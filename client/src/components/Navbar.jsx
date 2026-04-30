import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Navbar.css'

export default function Navbar({ foundingOpen = true }) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <a href="/" className="nav-logo">
        <div className="nav-logo-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="nav-logo-text">PADI</span>
      </a>

      <ul className="nav-links">
        <li><button className="nav-link-btn" onClick={() => scrollTo('features')}>Features</button></li>
        <li><button className="nav-link-btn" onClick={() => scrollTo('how-it-works')}>How it works</button></li>
        <li><button className="nav-link-btn" onClick={() => scrollTo('pricing')}>Pricing</button></li>
      </ul>

      <div className="nav-cta">
        <Link to="/login" className="nav-login">Log in</Link>
        {foundingOpen ? (
          <button className="btn btn-ghost" onClick={() => scrollTo('waitlist')}>
            Join first cohort
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          onClick={() => foundingOpen ? scrollTo('waitlist') : window.location.href = '/signup'}
        >
          Sign Up Now ↗
        </button>
      </div>

      <button
        className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      {menuOpen && (
        <div className="nav-mobile-menu">
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('how-it-works')}>How it works</button>
          <button onClick={() => scrollTo('pricing')}>Pricing</button>
          <Link to="/login" style={{padding:'12px 0',fontSize:15,color:'#555'}}>Log in</Link>
          <button className="btn btn-brand" style={{width:'100%',justifyContent:'center'}}
            onClick={() => foundingOpen ? scrollTo('waitlist') : window.location.href = '/signup'}>
            Sign Up Now ↗
          </button>
        </div>
      )}
    </nav>
  )
}