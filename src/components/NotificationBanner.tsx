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
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
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
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
