import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 text-center font-mono select-none">
          <div className="w-16 h-16 mb-4 bg-error-container/20 border border-error/50 flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>
          <span className="text-xs text-error tracking-widest uppercase mb-2">SOMETHING WENT WRONG</span>
          <h1 className="text-xl font-bold font-sans text-on-surface mb-3">Unexpected Application Error</h1>
          <p className="text-xs text-outline max-w-md mb-6 leading-relaxed">
            LiveLoom encountered an unexpected client error. Please try reloading the page or returning to the dashboard.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="ll-btn ll-btn-primary text-xs min-h-[40px] px-4"
            >
              RELOAD PAGE
            </button>
            <button
              onClick={this.handleGoHome}
              className="ll-btn ll-btn-ghost text-xs min-h-[40px] px-4"
            >
              DASHBOARD
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
