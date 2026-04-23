import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'

type Tab = 'login' | 'register'

export default function Auth() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    navigate('/dashboard')
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      if (tab === 'register') {
        await signIn('password', { name, email, password, flow: 'signUp' })
        navigate('/onboarding')
      } else {
        await signIn('password', { email, password, flow: 'signIn' })
        navigate('/dashboard')
      }
    } catch {
      setError(tab === 'login' ? 'Incorrect email or password' : 'An account with this email already exists')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)' }}>
        <div className="brand" style={{ marginBottom: 28 }}>
          <div className="brand-mark">Th</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--cream)', padding: 4, borderRadius: 10 }}>
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ flex: 1 }}
            >
              {t === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'register' && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Name</div>
              <input className="input" type="text" placeholder="Priya Raghavan" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input className="input" type="email" placeholder="priya@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Password</div>
            <input className="input" type="password" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ color: '#b91c1c', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
