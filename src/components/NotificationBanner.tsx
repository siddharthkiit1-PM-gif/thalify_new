import { useState, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'

const SESSION_KEY = 'thalify.bannerDismissed'

export default function NotificationBanner() {
  const { notifications, markRead } = useNotifications()
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(dismissed)))
  }, [dismissed])

  const latest = notifications.find(n => !n.read && !dismissed.has(n._id))
  if (!latest) return null

  function dismissNow() {
    setDismissed(s => new Set([...s, latest!._id]))
  }

  return (
    <div
      style={{
        background: 'var(--sage-100, #EEF7EC)',
        border: '1px solid var(--sage-700)',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        // Defensive: if the parent layout ever fails to constrain width
        // (e.g. a sibling forces a horizontal scroll), the banner itself
        // never extends past its container.
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--ink)',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {latest.message}
      </div>
      <button
        onClick={() => {
          markRead(latest._id)
          dismissNow()
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 18,
          padding: 0,
          lineHeight: 1,
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          borderRadius: 8,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
