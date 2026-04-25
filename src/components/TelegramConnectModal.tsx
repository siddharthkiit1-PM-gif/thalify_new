import { useEffect, useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function TelegramConnectModal({ open, onClose }: Props) {
  const generateLink = useAction(api.telegram.connect.generateConnectLink)
  const profile = useQuery(api.users.getProfile)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Generate the deep link the moment the modal opens
  useEffect(() => {
    if (!open) {
      setLink(null)
      setError('')
      return
    }
    setSubmitting(true)
    generateLink()
      .then(({ url }) => setLink(url))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to create link'))
      .finally(() => setSubmitting(false))
  }, [open, generateLink])

  // Auto-close once profile flips to connected
  useEffect(() => {
    if (open && profile?.telegramOptIn) {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [open, profile?.telegramOptIn, onClose])

  if (!open) return null

  const connected = profile?.telegramOptIn === true

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
          maxWidth: 420,
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
            Get nudges on Telegram
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

        {connected ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>✓</div>
            <p style={{ fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
              Connected. Nudges will arrive in your Telegram chat.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              One tap to connect. We'll open Telegram — just press <strong>Start</strong> and you're set. No phone number, no codes.
            </p>

            {submitting && (
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>
                Generating link…
              </div>
            )}

            {error && (
              <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {link && (
              <>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    textDecoration: 'none',
                    marginBottom: 12,
                  }}
                >
                  Open Telegram
                </a>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  Don't have Telegram? Install from{' '}
                  <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sage-700)' }}>
                    telegram.org/apps
                  </a>
                  .
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
                  Reply <strong>STOP</strong> in the bot chat anytime to unsubscribe.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
