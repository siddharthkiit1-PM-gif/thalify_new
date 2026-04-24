import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Tab = 'login' | 'register'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledEmail = searchParams.get('email') ?? ''
  const isFromWaitlist = searchParams.get('ref') === 'waitlist'
  const initialMode = searchParams.get('mode') === 'login' ? 'login' : 'register'
  const { signIn, signOut } = useAuthActions()
  const sendSignupWelcome = useAction(api.accountEmails.sendSignupWelcome)
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const profile = useQuery(api.users.getProfile)
  const [tab, setTab] = useState<Tab>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [signupComplete, setSignupComplete] = useState(false)
  const [createdEmail, setCreatedEmail] = useState('')
  const [createdName, setCreatedName] = useState('')

  useEffect(() => {
    if (signupComplete) return
    if (!submitted) return
    if (tab === 'register') return
    if (authLoading) return
    if (!isAuthenticated) return
    if (profile === undefined) return
    if (!profile || !profile.onboardingComplete) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [signupComplete, submitted, tab, authLoading, isAuthenticated, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (tab === 'register' && trimmedName.length < 2) { setError('Please enter your name'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Please enter a valid email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitted(true)
    try {
      if (tab === 'register') {
        await signIn('password', { name: trimmedName, email: trimmedEmail, password, flow: 'signUp' })
        sendSignupWelcome({ email: trimmedEmail, name: trimmedName }).catch(err => {
          console.error('Signup welcome email failed:', err)
        })
        setCreatedEmail(trimmedEmail)
        setCreatedName(trimmedName)
        try { await signOut() } catch { /* ignore */ }
        setPassword('')
        setSignupComplete(true)
        setSubmitted(false)
      } else {
        await signIn('password', { email: trimmedEmail, password, flow: 'signIn' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (tab === 'login') {
        setError('Incorrect email or password')
      } else if (msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('unique')) {
        setError('An account with this email already exists. Switching to Login…')
        setTimeout(() => { setTab('login'); setError(''); setName(''); setPassword('') }, 1500)
      } else {
        setError(msg || 'Sign in failed — please try again')
      }
      setSubmitted(false)
    }
  }

  function goToSignIn() {
    window.location.href = `/auth?email=${encodeURIComponent(createdEmail)}&mode=login`
  }

  const showLoading = submitted && !error

  if (signupComplete) {
    const firstName = createdName.split(/\s+/)[0] || 'there'
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div className="brand" style={{ marginBottom: 24, justifyContent: 'center' }}>
            <div className="brand-mark">Th</div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
          </div>

          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--sage-100, #EEF7EC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            fontSize: 32,
          }}>✓</div>

          <h1 className="serif" style={{ fontSize: 26, marginBottom: 10, lineHeight: 1.3 }}>
            Welcome to Thalify, {firstName}!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Your account is created. We've sent a welcome email to<br />
            <b style={{ color: 'var(--ink)' }}>{createdEmail}</b>
          </p>

          <div style={{ background: 'var(--cream)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              📧 Check your inbox
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Look for "Welcome to Thalify" from <b>Thalify</b>. Also check your spam folder just in case.
            </div>
          </div>

          <button onClick={goToSignIn} className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}>
            Sign in to continue →
          </button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Use the password you just set.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)' }}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <div className="brand-mark">Th</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
        </div>

        {isFromWaitlist && tab === 'register' && (
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
        </form>
      </div>
    </div>
  )
}
