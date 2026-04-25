import { useEffect, useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import TelegramLogo from './TelegramLogo'

interface Props {
  open: boolean
  onClose: () => void
}

type Phase = 'loading' | 'ready' | 'waiting' | 'connected' | 'error'

export default function TelegramConnectModal({ open, onClose }: Props) {
  const generateLink = useAction(api.telegram.connect.generateConnectLink)
  const profile = useQuery(api.users.getProfile)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [linkOpened, setLinkOpened] = useState(false)

  // Generate the deep link the moment the modal opens
  useEffect(() => {
    if (!open) {
      setLink(null)
      setError('')
      setLinkOpened(false)
      return
    }
    generateLink()
      .then(({ url }) => setLink(url))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to create link'))
  }, [open, generateLink])

  // Auto-close once profile flips to connected
  useEffect(() => {
    if (open && profile?.telegramOptIn) {
      const t = setTimeout(onClose, 2400)
      return () => clearTimeout(t)
    }
  }, [open, profile?.telegramOptIn, onClose])

  if (!open) return null

  const connected = profile?.telegramOptIn === true
  const phase: Phase = error
    ? 'error'
    : connected
    ? 'connected'
    : !link
    ? 'loading'
    : linkOpened
    ? 'waiting'
    : 'ready'

  return (
    <div className="tg-modal-backdrop" onClick={onClose}>
      <div className="tg-modal" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        <button className="tg-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="tg-modal-hero">
          <div className="tg-modal-pedestal">
            <span className="tg-bob">
              <TelegramLogo size={56} />
            </span>
          </div>

          {phase === 'connected' ? (
            <>
              <div className="tg-eyebrow">All set</div>
              <h2 className="tg-headline">You&rsquo;re in.</h2>
              <p className="tg-sub">Nudges will arrive in your Telegram chat — no need to keep this open.</p>
            </>
          ) : (
            <>
              <div className="tg-eyebrow">Integration · Telegram</div>
              <h2 className="tg-headline">Two taps. One conversation.</h2>
              <p className="tg-sub">Connect once and every meal you log gets a personalized nudge in Telegram.</p>
            </>
          )}
        </div>

        {phase === 'connected' && (
          <>
            <div className="tg-success-mark">✓</div>
            <div className="tg-bot-bubble">
              Connected to Thalify ✓ You&rsquo;ll get nudges here based on your meals.
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="tg-waiting">
            <span>Generating your link</span>
            <span className="tg-dots"><span /><span /><span /></span>
          </div>
        )}

        {phase === 'waiting' && (
          <>
            <div className="tg-waiting">
              <span>Waiting for you to tap <b>Start</b> in Telegram</span>
              <span className="tg-dots"><span /><span /><span /></span>
            </div>
            <a
              href={link!}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tg btn-lg"
              style={{ width: '100%', marginBottom: 6 }}
              onClick={() => setLinkOpened(true)}
            >
              <TelegramLogo size={18} /> Open Telegram again
            </a>
            <p className="tg-trust">
              This auto-completes the moment you tap Start in the bot chat.
            </p>
          </>
        )}

        {phase === 'ready' && (
          <>
            <div className="tg-bullets">
              <div className="tg-bullet">
                <span className="tg-bullet-icon">🪶</span>
                <span><b>No phone number.</b> Just your Telegram username.</span>
              </div>
              <div className="tg-bullet">
                <span className="tg-bullet-icon">⚡</span>
                <span><b>Instant.</b> Personalized nudge after every meal you log.</span>
              </div>
              <div className="tg-bullet">
                <span className="tg-bullet-icon">🌿</span>
                <span><b>Pause anytime.</b> Reply STOP in the bot chat.</span>
              </div>
            </div>

            <a
              href={link!}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-tg btn-lg"
              style={{ width: '100%' }}
              onClick={() => setLinkOpened(true)}
            >
              <TelegramLogo size={18} /> Connect with Telegram
            </a>

            <p className="tg-trust">
              Free forever &middot; <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer">Don&rsquo;t have Telegram?</a>
            </p>
          </>
        )}

        {phase === 'error' && (
          <div style={{ color: 'var(--red)', fontSize: 13, padding: '14px 16px', background: 'var(--red-bg)', border: '1px solid var(--red-br)', borderRadius: 10, marginTop: 14 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
