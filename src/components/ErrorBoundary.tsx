import { Component } from 'react'
import { type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', gap: 16 }}>
          <div style={{ fontSize: 40 }}>😔</div>
          <div className="serif" style={{ fontSize: 24 }}>Something went wrong</div>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}
