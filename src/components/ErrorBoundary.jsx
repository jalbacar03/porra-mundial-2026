import { Component } from 'react'
import { Sentry } from '../sentry'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    if (Sentry?.captureException) {
      Sentry.captureException(error, { extra: errorInfo })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: '40vh',
        }}>
          <span style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</span>
          <h3 style={{
            margin: '0 0 8px',
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}>
            Algo ha fallado
          </h3>
          <p style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            maxWidth: '300px',
            lineHeight: '1.5',
          }}>
            Ha ocurrido un error inesperado. Recarga la página para continuar.
          </p>
          {this.state.error && (
            <details style={{
              maxWidth: '340px', width: '100%', marginBottom: '18px',
              textAlign: 'left', fontSize: '11px', color: 'var(--text-dim)'
            }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Detalles del error
              </summary>
              <pre style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '6px',
                fontSize: '10.5px', lineHeight: '1.45', maxHeight: '220px', overflow: 'auto',
                margin: 0
              }}>
                {String(this.state.error?.message || this.state.error)}
                {this.state.error?.stack ? '\n\n' + this.state.error.stack : ''}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              padding: '10px 24px',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
