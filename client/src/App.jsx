import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell.jsx'
import PWAInstallPrompt from './components/ui/PWAInstallPrompt.jsx'
import SupportWidget from './components/ui/SupportWidget.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

import LandingPage         from './pages/LandingPage.jsx'
import LoginPage           from './pages/LoginPage.jsx'
import SignupPage          from './pages/SignupPage.jsx'
import OnboardingPage      from './pages/OnboardingPage.jsx'
import CheckEmailPage      from './pages/CheckEmailPage.jsx'
import AuthCallback        from './pages/AuthCallback.jsx'
import DashboardPage       from './pages/DashboardPage.jsx'
import AskPage             from './pages/AskPage.jsx'
import StudyPacksPage      from './pages/StudyPacksPage.jsx'
import ExamPage            from './pages/ExamPage.jsx'
import PastQuestionsPage        from './pages/PastQuestionsPage.jsx'
import TutorialQuestionsPage    from './pages/TutorialQuestionsPage.jsx'
import LibraryPage         from './pages/LibraryPage.jsx'
import ReviewPage          from './pages/ReviewPage.jsx'
import AdminPage           from './pages/AdminPage.jsx'
import AccountPage         from './pages/AccountPage.jsx'
import PricingPage         from './pages/PricingPage.jsx'
import PaymentSuccessPage  from './pages/PaymentSuccessPage.jsx'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages.jsx'

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
      <Routes>
        {/* Public */}
        <Route path="/"               element={<LandingPage />} />
        <Route path="/auth/callback"  element={<AuthCallback />} />
        <Route path="/check-email"    element={<CheckEmailPage />} />
        <Route path="/pricing"        element={<PricingPage />} />

        {/* Public only */}
        <Route path="/login"           element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/signup"          element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

        {/* App — sidebar shell */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard"        element={<DashboardPage />} />
          <Route path="/ask"              element={<AskPage />} />
          <Route path="/study-packs"      element={<StudyPacksPage />} />
          <Route path="/exam"             element={<ExamPage />} />
          <Route path="/past-questions"       element={<PastQuestionsPage />} />
          <Route path="/tutorial-questions"   element={<TutorialQuestionsPage />} />
          <Route path="/library"          element={<LibraryPage />} />
          <Route path="/review"           element={<ReviewPage />} />
          <Route path="/admin"            element={<AdminPage />} />
          <Route path="/account"          element={<AccountPage />} />
          <Route path="/payment/success"  element={<PaymentSuccessPage />} />
          <Route path="/payment/verify"   element={<PaymentSuccessPage />} />
        </Route>

        <Route path="/privacy" element={<PolicyPage type="privacy" />} />
        <Route path="/terms"   element={<PolicyPage type="terms" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Global UI — shown across all pages */}
      <PWAInstallPrompt />
      <SupportWidget />
      </ErrorBoundary>
    </AuthProvider>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#0C0C14', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:'system-ui' }}>
      <div style={{fontSize:48}}>🔍</div>
      <h1 style={{color:'white', fontSize:24, fontWeight:700}}>Page not found</h1>
      <a href="/" style={{color:'#4F46E5', fontSize:14, textDecoration:'none', fontWeight:600}}>← Back to home</a>
    </div>
  )
}

function PolicyPage({ type }) {
  const isPrivacy = type === 'privacy'
  return (
    <div style={{ minHeight:'100vh', background:'#0C0C14', fontFamily:'system-ui', padding:'48px 24px' }}>
      <div style={{ maxWidth:680, margin:'0 auto', color:'rgba(255,255,255,0.85)' }}>
        <a href="/" style={{color:'#4F46E5', fontSize:14, textDecoration:'none', fontWeight:600, display:'block', marginBottom:32}}>← Back to home</a>
        <h1 style={{color:'white', fontSize:28, fontWeight:700, marginBottom:8}}>
          {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p style={{color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:40}}>Last updated: March 2026 · Effective date: March 2026</p>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <div style={{marginTop:48, paddingTop:24, borderTop:'1px solid rgba(255,255,255,0.08)', fontSize:13, color:'rgba(255,255,255,0.35)'}}>
          Padi is a product of Syca Works Ltd · <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a> · yourpadi.com
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{marginBottom:36}}>
      <h2 style={{color:'white', fontSize:16, fontWeight:700, marginBottom:10, letterSpacing:'-0.2px'}}>{title}</h2>
      <div style={{color:'rgba(255,255,255,0.68)', fontSize:15, lineHeight:1.75}}>{children}</div>
    </div>
  )
}

function Li({ children }) {
  return <li style={{marginBottom:6}}>{children}</li>
}

function Ul({ children }) {
  return <ul style={{paddingLeft:20, marginTop:8, marginBottom:8}}>{children}</ul>
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. Who we are">
        Padi ("Padi", "we", "us", "our") is an AI-powered study platform operated by Syca Works Ltd, Nigeria. Padi is the data controller for personal information collected through yourpadi.com and the Padi app. For questions or requests, contact us at <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a>.
      </Section>

      <Section title="2. Information we collect">
        <p style={{marginBottom:8}}>We collect the following categories of personal data:</p>
        <Ul>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Account information:</strong> first name, last name, preferred name, email address, date of birth, university, and course of study. Collected at signup.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Payment information:</strong> subscription status, plan type, and payment reference numbers. Your card details are processed directly by Paystack or Stripe and never stored on our servers.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Study content:</strong> questions you ask, study packs you generate, exam results, and summaries of documents you upload. These are stored to personalise your experience and are never shared with other users.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Usage data:</strong> pages visited, features used, session duration, and device/browser type, collected via PostHog analytics.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Support communications:</strong> messages you send to our support email.</Li>
        </Ul>
        We do not collect sensitive personal data such as financial account numbers, biometric data, or government identification numbers.
      </Section>

      <Section title="3. How we use your information">
        <p style={{marginBottom:8}}>We process your personal data for the following purposes and on the following legal bases:</p>
        <Ul>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>To provide the service (contractual necessity):</strong> personalising AI responses with your course and university, generating study packs and exam simulations, managing your subscription and access.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>To process payments (contractual necessity):</strong> verifying payments via Paystack and Stripe webhooks and activating or pausing your subscription accordingly.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>To send transactional emails (contractual necessity):</strong> welcome emails, payment confirmations, renewal reminders, and payment failure notices via Resend.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>To improve the platform (legitimate interest):</strong> analysing aggregated usage data to improve features and performance. We do not use your personal study content for this purpose.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>To comply with legal obligations:</strong> retaining transaction records as required under Nigerian law.</Li>
        </Ul>
        We do not sell, rent, or trade your personal data to any third party for marketing purposes.
      </Section>

      <Section title="4. AI processing and document uploads">
        When you upload a document (lecture notes, textbooks, past papers), Padi extracts and summarises the content to personalise future AI responses for your account only. This summary is stored in our database and associated exclusively with your user ID. It is never used to generate responses for other users and is never included in cached AI responses shared across accounts. Your document content is transmitted to Anthropic's API (our AI provider) solely to generate your requested output. Anthropic does not train its models on your data under our API agreement.
      </Section>

      <Section title="5. Third-party service providers">
        <p style={{marginBottom:8}}>We share your data with the following processors, each bound by data processing agreements:</p>
        <Ul>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Supabase</strong> (database hosting, USA/EU) — stores your account, study content, and subscription data.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Anthropic</strong> (AI processing, USA) — processes your questions and uploaded content to generate AI responses.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Paystack</strong> (payment processing, Nigeria) — processes Nigerian card payments.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Stripe</strong> (payment processing, USA) — processes international card payments.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Resend</strong> (transactional email, USA) — delivers account and subscription emails.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>PostHog</strong> (analytics, EU/USA) — collects anonymised usage analytics and session data.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Cloudflare</strong> (storage and CDN, global) — stores uploaded files.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Vercel</strong> (frontend hosting, USA/EU) — serves the Padi web application.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Railway</strong> (backend hosting, USA) — hosts the Padi API server.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Tavily</strong> (web search, USA) — used when you enable the web search feature on the Ask page to supplement AI responses with current information.</Li>
        </Ul>
        Some of these providers are located outside Nigeria. Where personal data is transferred internationally, we rely on standard contractual clauses and the providers' compliance with applicable data protection frameworks.
      </Section>

      <Section title="6. Data retention">
        <Ul>
          <Li>Account and profile data is retained for as long as your account is active.</Li>
          <Li>Study content (packs, answers, exam history) is retained indefinitely until you delete it or request account deletion.</Li>
          <Li>Payment records are retained for 7 years as required by Nigerian financial regulations.</Li>
          <Li>Analytics data is retained for 12 months on a rolling basis.</Li>
          <Li>If you request account deletion, we will delete or anonymise your personal data within 30 days, except where retention is required by law.</Li>
        </Ul>
      </Section>

      <Section title="7. Your rights under the Nigeria Data Protection Act 2023">
        <p style={{marginBottom:8}}>Under the NDPA 2023, you have the right to:</p>
        <Ul>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Access</strong> a copy of the personal data we hold about you.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Rectification</strong> of inaccurate or incomplete data.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Erasure</strong> ("right to be forgotten") — request deletion of your account and associated data.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Data portability</strong> — receive your data in a machine-readable format.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Object to processing</strong> carried out on the basis of legitimate interest.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Withdraw consent</strong> at any time where processing is based on consent.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Lodge a complaint</strong> with the Nigeria Data Protection Commission (NDPC) at ndpc.gov.ng.</Li>
        </Ul>
        To exercise any of these rights, email <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a>. We will respond within 30 days.
      </Section>

      <Section title="8. Cookies and analytics">
        Padi uses PostHog to collect anonymised analytics data including pages visited, features used, and session recordings. This helps us understand how students use the platform and improve it. You can opt out of session recording by contacting us. We do not use advertising cookies or share analytics data with advertisers.
      </Section>

      <Section title="9. Children's privacy">
        Padi is intended for university and secondary school students. We do not knowingly collect data from children under 13. If you believe a child under 13 has registered, please contact us immediately at support@yourpadi.com and we will delete the account.
      </Section>

      <Section title="10. Security">
        We implement industry-standard security measures including database row-level security, encrypted connections (HTTPS/TLS), and hashed passwords via Supabase Auth. Payment data is handled entirely by PCI-DSS compliant processors (Paystack, Stripe). Despite these measures, no system is completely secure — if you suspect unauthorised access to your account, contact us immediately.
      </Section>

      <Section title="11. Changes to this policy">
        We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email at least 14 days before the changes take effect. Continued use of Padi after that date constitutes acceptance of the updated policy. The "last updated" date at the top of this page will always reflect the most recent version.
      </Section>

      <Section title="12. Contact us">
        For any privacy-related questions, requests, or complaints:<br />
        Email: <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a><br />
        We aim to respond within 24 hours on business days.
      </Section>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <Section title="1. Acceptance of terms">
        By creating an account or using Padi ("the Service"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree, do not use Padi. These Terms constitute a legally binding agreement between you and Syca Works Ltd ("we", "us", "our"), the operator of Padi. By continuing to use the Service after any updates to these Terms, you accept the revised version.
      </Section>

      <Section title="2. About Padi">
        Padi is an AI-powered educational study platform designed to help Nigerian university and secondary school students prepare for examinations. It provides AI-generated answers, study packs, exam simulations, past question analysis, spaced repetition, and a personal offline library. Padi is a product of Syca Works Ltd, a Nigerian technology company.
      </Section>

      <Section title="3. Eligibility">
        <Ul>
          <Li>You must be at least 13 years old to use Padi.</Li>
          <Li>If you are under 18, you confirm that you have parental or guardian consent to use the Service.</Li>
          <Li>You must provide accurate information when creating your account. Impersonation or providing false information is grounds for immediate account termination.</Li>
          <Li>One account per person. Creating multiple accounts to circumvent usage limits or pricing is prohibited.</Li>
        </Ul>
      </Section>

      <Section title="4. Account security">
        You are responsible for maintaining the confidentiality of your login credentials. You must not share your account with others or allow others to access the Service through your account. Notify us immediately at support@yourpadi.com if you suspect unauthorised access. We are not liable for any loss or damage arising from unauthorised account use where you have not notified us.
      </Section>

      <Section title="5. Subscriptions and pricing">
        <Ul>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Monthly plan:</strong> ₦3,000/month, billed monthly. For international users: $2 USD/month via Stripe.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Semester bundle:</strong> ₦10,000 for 4 months (~17% saving). For international users: $7 USD for 4 months via Stripe. Semester bundles do not auto-renew; you must manually re-subscribe after 4 months.</Li>
          <Li><strong style={{color:'rgba(255,255,255,0.85)'}}>Founding member pricing:</strong> The first 100 paying users ("Founding Members") pay ₦1,500 in their first month. From their second month onwards, and indefinitely, their price is locked at ₦3,000/month — even if standard pricing increases in the future.</Li>
          <Li>Subscriptions begin as soon as your payment is confirmed. Access continues until the end of your current billing period upon cancellation.</Li>
          <Li>Prices are stated in Nigerian Naira (₦) or USD ($) and include all applicable fees. We reserve the right to change pricing for new subscribers with 30 days' notice.</Li>
        </Ul>
      </Section>

      <Section title="6. Payment and billing">
        <Ul>
          <Li>Nigerian payments are processed by Paystack (paystack.com). International payments are processed by Stripe (stripe.com). By subscribing, you agree to their respective terms of service.</Li>
          <Li>Your card details are collected and processed directly by Paystack or Stripe. Padi never stores your card number, CVV, or expiry date.</Li>
          <Li>Monthly subscriptions renew automatically on your billing date. You will receive a renewal reminder 3 days before each renewal.</Li>
          <Li>If a payment fails, you will receive an immediate email notification. Your access will continue for a 3-day grace period, during which you may update your payment method. After the grace period, access is paused until payment is resolved.</Li>
        </Ul>
      </Section>

      <Section title="7. Refund policy">
        We offer a full, no-questions-asked refund within 48 hours of your first payment. To request a refund, email <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a> within 48 hours of purchase with the subject line "Refund Request". Refunds are processed within 3–5 business days via the original payment method. After the 48-hour window, refunds are issued at our discretion in cases of documented technical failure on our part.
      </Section>

      <Section title="8. Cancellation">
        You may cancel your subscription at any time from your Account settings page. Cancellation takes effect at the end of your current billing period — you retain full access until then. We do not provide partial refunds for unused time except within the 48-hour refund window. If you cancel, your study content and library are retained in your account for 90 days in case you reactivate. After 90 days of inactivity post-cancellation, your data may be permanently deleted.
      </Section>

      <Section title="9. AI-generated content disclaimer">
        Padi uses large language models (Claude by Anthropic) to generate study materials, explanations, exam questions, and analyses. You acknowledge that:
        <Ul>
          <Li>AI-generated content may contain errors, inaccuracies, or outdated information.</Li>
          <Li>Content generated by Padi does not constitute professional academic, legal, medical, or financial advice.</Li>
          <Li>You should always verify important information against your official course materials, textbooks, and lecturers.</Li>
          <Li>Padi is a study aid — not a replacement for attending classes, reading your course materials, or engaging with your institution.</Li>
          <Li>Web search results (when enabled) are sourced from third-party websites and are provided for supplementary context only. Padi does not verify the accuracy of web content.</Li>
        </Ul>
        Padi is not responsible for academic outcomes, exam results, or decisions made based on AI-generated content.
      </Section>

      <Section title="10. Acceptable use">
        <p style={{marginBottom:8}}>You agree not to use Padi to:</p>
        <Ul>
          <Li>Submit AI-generated work as your own in violation of your institution's academic integrity policy — Padi is a learning tool, not a cheating tool.</Li>
          <Li>Attempt to reverse-engineer, scrape, or extract data from the platform in bulk.</Li>
          <Li>Upload content that is defamatory, unlawful, harassing, or infringes third-party intellectual property rights.</Li>
          <Li>Attempt to circumvent rate limits, authentication, or subscription requirements.</Li>
          <Li>Share your account credentials with others or allow multiple people to use a single subscription.</Li>
          <Li>Use the platform for any purpose other than personal educational study.</Li>
        </Ul>
        Violation of these terms may result in immediate account suspension without refund.
      </Section>

      <Section title="11. Intellectual property">
        The Padi platform, including its design, branding, code, and proprietary features, is owned by Syca Works Ltd and protected by Nigerian and international intellectual property law. Study content generated by Padi's AI using your inputs is licensed to you for personal, non-commercial educational use. You may not reproduce, distribute, or commercialise AI-generated content from Padi without our written consent. Content you upload to Padi (your own lecture notes, documents) remains your property. You grant us a limited licence to process this content solely to provide you with the Service.
      </Section>

      <Section title="12. Disclaimer of warranties">
        Padi is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free from viruses or other harmful components. We make no warranty that AI-generated content is accurate, complete, or fit for any particular purpose. Your use of the Service is at your own risk.
      </Section>

      <Section title="13. Limitation of liability">
        To the maximum extent permitted by Nigerian law, Syca Works Ltd and its directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including lost academic opportunities, exam failure, data loss, or loss of profit — arising from your use of Padi. Our total liability to you for any claim arising from these Terms or your use of the Service shall not exceed the total amount you paid to us in the 3 months preceding the claim.
      </Section>

      <Section title="14. Governing law and disputes">
        These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any dispute arising from or related to these Terms or your use of Padi shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria. We encourage you to contact us first at support@yourpadi.com — most concerns can be resolved quickly without formal proceedings.
      </Section>

      <Section title="15. Changes to these terms">
        We may update these Terms at any time. If we make material changes, we will notify you by email at least 14 days in advance. Your continued use of Padi after that date constitutes acceptance of the revised Terms. If you do not agree to the changes, you may cancel your subscription before the effective date and request a refund for any unused period.
      </Section>

      <Section title="16. Contact">
        For questions about these Terms, subscription matters, or to exercise your rights:<br />
        Email: <a href="mailto:support@yourpadi.com" style={{color:'#4F46E5', textDecoration:'none'}}>support@yourpadi.com</a><br />
        We aim to respond within 24 hours on business days.
      </Section>
    </>
  )
}
