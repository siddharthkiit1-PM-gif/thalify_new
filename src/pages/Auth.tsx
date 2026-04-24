import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Tab = 'login' | 'register'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledEmail = searchParams.get('email') ?? ''
  const isFromWaitlist = searchParams.get('ref') === 'waitlist'
  const { signIn } = useAuthActions()
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const profile = useQuery(api.users.getProfile)
  const [tab, setTab] = useState<Tab>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!submitted && !isAuthenticated) return
    if (authLoading) return
    if (!isAuthenticated) return
    if (profile === undefined) return
    if (!profile || !profile.onboardingComplete) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [submitted, authLoading, isAuthenticated, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitted(true)
    try {
      if (tab === 'register') {
        await signIn('password', { name, email, password, flow: 'signUp' })
      } else {
        await signIn('password', { email, password, flow: 'signIn' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (tab === 'login') {
        setError('Incorrect email or password')
      } else if (msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        setError('An account with this email already exists — try Login instead')
      } else {
        setError(msg || 'Sign in failed — please try again')
      }
      setSubmitted(false)
    }
  }

  const showLoading = submitted && !error

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)' }}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <div className="brand-mark">Th</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
        </div>

        {isFromWaitlist && (
          <div style={{ background: 'var(--sage-100, #EEF7EC)', color: 'var(--sage-700)', padding: '12px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Welcome — your early access is active.</div>
            <div style={{ color: 'var(--ink-2)' }}>Set a password to create your account.</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--cream)', padding: 4, borderRadius: 10 }}>
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ flex: 1 }}
              disabled={showLoading}
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

          <button type="submit" className="btn btn-primary" disabled={showLoading} style={{ marginTop: 4 }}>
            {showLoading ? (tab === 'register' ? 'Creating account…' : 'Signing in…') : (tab === 'login' ? 'Sign In' : 'Create Account')}
          </button>

          {showLoading && isAuthenticated && profile === undefined && (
            <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Loading your account…
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
