import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function WhatsappOptInModal({ open, onClose }: Props) {
  const requestOptIn = useAction(api.whatsapp.optIn.requestOptIn)
  const confirmOptIn = useAction(api.whatsapp.optIn.confirmOptIn)
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState('+91')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function sendCode() {
    setError('')
    setSubmitting(true)
    try {
      await requestOptIn({ phoneE164: phone.trim() })
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code')
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyCode() {
    setError('')
    setSubmitting(true)
    try {
      await confirmOptIn({ code: code.trim() })
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 28,
          maxWidth: 400,
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 20 }}>
            Get nudges on WhatsApp
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--muted)',
            }}
          >
            ×
          </button>
        </div>

        {step === 'phone' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              We'll send a 6-digit code to verify the number.
            </p>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+919876543210"
              style={{ marginBottom: 12 }}
            />
            {error && (
              <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={sendCode}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Sending…' : 'Send verification code'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
              By continuing, you agree to receive WhatsApp nudges. Reply STOP anytime to unsubscribe.
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Code sent to {phone}. Enter the 6 digits below.
            </p>
            <input
              className="input"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              style={{
                marginBottom: 12,
                fontSize: 18,
                letterSpacing: '0.2em',
                textAlign: 'center',
              }}
            />
            {error && (
              <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={verifyCode}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>✓</div>
            <p style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              You're set up. Nudges will arrive on WhatsApp from now on.
            </p>
            <button
              className="btn btn-primary"
              onClick={onClose}
              style={{ width: '100%' }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
