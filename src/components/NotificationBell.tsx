import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: 8,
          fontSize: 18,
          lineHeight: 1,
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'var(--sage-700)',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            minWidth: 320,
            maxHeight: 480,
            overflow: 'auto',
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 600 }}>Notifications</div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--sage-700)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div
              style={{
                padding: 20,
                color: 'var(--muted)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No notifications yet — log a meal to start.
            </div>
          )}

          {notifications.map(n => (
            <div
              key={n._id}
              onClick={() => !n.read && markRead(n._id)}
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'var(--cream)',
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>
                {n.message}
              </div>
              <div
                style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}
              >
                {n.bucket} ·{' '}
                {new Date(n.createdAt).toLocaleString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
