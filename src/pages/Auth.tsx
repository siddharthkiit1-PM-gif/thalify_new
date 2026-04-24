import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Tab = 'login' | 'register'
type View = 'form' | 'signupSuccess' | 'forgotRequest' | 'forgotReset'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledEmail = searchParams.get('email') ?? ''
  const isFromWaitlist = searchParams.get('ref') === 'waitlist'
  const initialMode = searchParams.get('mode') === 'login' ? 'login' : searchParams.get('mode') === 'reset' ? 'login' : 'register'
  const resetCodeFromUrl = searchParams.get('code') ?? ''
  const isResetMode = searchParams.get('mode') === 'reset'

  const { signIn, signOut } = useAuthActions()
  const sendSignupWelcome = useAction(api.accountEmails.sendSignupWelcome)
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const profile = useQuery(api.users.getProfile)

  const [view, setView] = useState<View>(isResetMode ? 'forgotReset' : 'form')
  const [tab, setTab] = useState<Tab>(initialMode as Tab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetCode, setResetCode] = useState(resetCodeFromUrl)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [createdEmail, setCreatedEmail] = useState('')
  const [createdName, setCreatedName] = useState('')

  useEffect(() => {
    if (view === 'signupSuccess') return
    if (!submitted) return
    if (tab === 'register' && view === 'form') return
    if (authLoading) return
    if (!isAuthenticated) return
    if (profile === undefined) return
    if (!profile || !profile.onboardingComplete) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [view, submitted, tab, authLoading, isAuthenticated, profile, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    if (tab === 'register' && trimmedName.length < 2) { setError('Please enter your name'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('Please enter a valid email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitted(true)
    try {
      if (tab === 'register') {
        await signIn('password', { name: trimmedName, email: normalizedEmail, password, flow: 'signUp' })
        // Must await before signOut — the action checks auth server-side,
        // and signOut invalidates the session before the server can process it.
        try {
          await sendSignupWelcome({ email: normalizedEmail, name: trimmedName })
        } catch (err) {
          console.error('Signup welcome email failed:', err)
        }
        setCreatedEmail(normalizedEmail)
        setCreatedName(trimmedName)
        try { await signOut() } catch { /* ignore */ }
        setPassword('')
        setView('signupSuccess')
        setSubmitted(false)
      } else {
        await signIn('password', { email: normalizedEmail, password, flow: 'signIn' })
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

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('Please enter a valid email'); return }
    setSubmitted(true)
    try {
      await signIn('password', { email: normalizedEmail, flow: 'reset' })
      setInfo('If an account exists for this email, a reset code is on its way.')
      setTimeout(() => {
        setView('forgotReset')
        setInfo('')
      }, 1200)
    } catch {
      // Intentionally generic — prevents email enumeration (don't reveal
      // whether an account exists for this email).
      setInfo('If an account exists for this email, a reset code is on its way.')
      setTimeout(() => setView('forgotReset'), 1200)
    } finally {
      setSubmitted(false)
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    const code = resetCode.trim().toUpperCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('Please enter a valid email'); return }
    if (code.length < 6) { setError('Enter the code from your email'); return }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters'); return }
    setSubmitted(true)
    try {
      await signIn('password', { email: normalizedEmail, code, newPassword, flow: 'reset-verification' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('code') ? 'Invalid or expired code. Please request a new one.' : (msg || 'Could not reset password'))
      setSubmitted(false)
    }
  }

  function goToSignIn() {
    window.location.href = `/auth?email=${encodeURIComponent(createdEmail)}&mode=login`
  }

  const showLoading = submitted && !error && !info

  // Signup success screen
  if (view === 'signupSuccess') {
    const firstName = createdName.split(/\s+/)[0] || 'there'
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)', textAlign: 'center' }}>
          <div className="brand" style={{ marginBottom: 24, justifyContent: 'center' }}>
            <div className="brand-mark">Th</div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--sage-100, #EEF7EC)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
          <h1 className="serif" style={{ fontSize: 26, marginBottom: 10, lineHeight: 1.3 }}>
            Welcome to Thalify, {firstName}!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Your account is created. We've sent a welcome email to<br />
            <b style={{ color: 'var(--ink)' }}>{createdEmail}</b>
          </p>
          <div style={{ background: 'var(--cream)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>📧 Check your inbox</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>Look for "Welcome to Thalify". Also check your spam folder.</div>
          </div>
          <button onClick={goToSignIn} className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}>Sign in to continue →</button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Use the password you just set.</div>
        </div>
      </div>
    )
  }

  // Shell wrapper for the remaining views
  const wrapper = (content: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: 'var(--sand)', borderRadius: 20, border: '1px solid var(--border)' }}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <div className="brand-mark">Th</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Thalify</span>
        </div>
        {content}
      </div>
    </div>
  )

  // Forgot — request code
  if (view === 'forgotRequest') {
    return wrapper(
      <>
        <h2 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Reset your password</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Enter your email and we'll send you a reset code. It's valid for 30 minutes.
        </p>
        <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          {info && <div style={{ color: 'var(--sage-700)', fontSize: 13, padding: '8px 12px', background: 'var(--sage-100, #EEF7EC)', borderRadius: 8 }}>{info}</div>}
          {error && <div style={{ color: '#b91c1c', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={showLoading}>
            {showLoading ? 'Sending code…' : 'Send reset code'}
          </button>
          <button type="button" onClick={() => { setView('form'); setTab('login'); setError(''); setInfo('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
            ← Back to sign in
          </button>
        </form>
      </>
    )
  }

  // Forgot — enter code + new password
  if (view === 'forgotReset') {
    return wrapper(
      <>
        <h2 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Enter your reset code</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Check your inbox for the 8-character code. Enter it along with your new password.
        </p>
        <form onSubmit={handleForgotReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Reset code</div>
            <input className="input" type="text" value={resetCode} onChange={e => setResetCode(e.target.value.toUpperCase())} required placeholder="8-char code from email" maxLength={12} style={{ fontFamily: 'var(--mono)', letterSpacing: '0.1em' }} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>New password</div>
            <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Min 8 characters" />
          </div>
          {error && <div style={{ color: '#b91c1c', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={showLoading}>
            {showLoading ? 'Resetting…' : 'Reset password & sign in'}
          </button>
          <button type="button" onClick={() => { setView('forgotRequest'); setResetCode(''); setNewPassword(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
            Didn't get the code? Request again
          </button>
        </form>
      </>
    )
  }

  // Default: login / register
  return wrapper(
    <>
      {isFromWaitlist && tab === 'register' && (
        <div style={{ background: 'var(--sage-100, #EEF7EC)', color: 'var(--sage-700)', padding: '12px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Welcome — your early access is active.</div>
          <div style={{ color: 'var(--ink-2)' }}>Set a password to create your account.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--cream)', padding: 4, borderRadius: 10 }}>
        {(['login', 'register'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setError('') }} className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ flex: 1 }} disabled={showLoading}>
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
          <div className="label" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Password</span>
            {tab === 'login' && (
              <button type="button" onClick={() => { setView('forgotRequest'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--sage-700)', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                Forgot password?
              </button>
            )}
          </div>
          <input className="input" type="password" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        {error && <div style={{ color: '#b91c1c', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={showLoading} style={{ marginTop: 4 }}>
          {showLoading ? (tab === 'register' ? 'Creating account…' : 'Signing in…') : (tab === 'login' ? 'Sign In' : 'Create Account')}
        </button>
      </form>
    </>
  )
}
