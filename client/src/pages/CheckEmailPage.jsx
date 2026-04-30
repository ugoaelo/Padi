import { Link } from 'react-router-dom'
import './AuthPages.css'

export default function CheckEmailPage() {
  return (
    <div className="auth-bg">
      <div className="auth-card" style={{textAlign:'center'}}>
        <div className="auth-logo" style={{justifyContent:'center'}}>
          <div className="auth-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
            </svg>
          </div>
          <span className="auth-logo-text">PADI</span>
        </div>
        <div className="auth-success-icon" style={{fontSize:48, margin:'24px 0 16px'}}>📬</div>
        <h1 className="auth-title">Check your email</h1>
        <p className="auth-sub">
          We sent a confirmation link to your email address.
          Click it to activate your account and start studying.
        </p>
        <p className="auth-sub" style={{fontSize:13, marginTop:8}}>
          Can't find it? Check your spam folder.
        </p>
        <Link to="/login" className="btn btn-brand"
          style={{display:'inline-flex', marginTop:28, justifyContent:'center'}}>
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
