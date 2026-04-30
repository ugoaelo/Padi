import { Component } from 'react'

/**
 * ErrorBoundary — catches unhandled render errors and shows a
 * friendly fallback instead of a white screen.
 *
 * Wrap individual routes or sections for targeted error containment,
 * or wrap the whole <Routes> tree for a global catch.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap for a logging service (Sentry etc.) in prod
    console.error('[ErrorBoundary] Uncaught render error:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight:      '100vh',
        background:     '#0C0C14',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            20,
        padding:        24,
        fontFamily:     'system-ui, sans-serif',
        textAlign:      'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ color: '#aaa', fontSize: 15, maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
          Padi hit an unexpected error. Your progress is safe — this is just a display glitch.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={this.handleReset}
            style={{
              background:   '#4F46E5',
              color:        'white',
              border:       'none',
              borderRadius: 10,
              padding:      '12px 24px',
              fontSize:     15,
              fontWeight:   700,
              cursor:       'pointer',
            }}
          >
            Back to dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background:   'transparent',
              color:        '#aaa',
              border:       '1px solid #333',
              borderRadius: 10,
              padding:      '12px 24px',
              fontSize:     15,
              cursor:       'pointer',
            }}
          >
            Reload page
          </button>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            color:        '#f87171',
            fontSize:     11,
            maxWidth:     500,
            overflowX:    'auto',
            background:   '#1a1a2e',
            padding:      12,
            borderRadius: 8,
            textAlign:    'left',
          }}>
            {this.state.error?.message}
          </pre>
        )}
      </div>
    )
  }
}
