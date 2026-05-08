import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useIsMobile } from '../hooks/useIsMobile'

/**
 * Notifications dropdown.
 *
 * Mobile (<=768px): renders as a viewport-fixed sheet anchored below the
 * navbar with a subtle backdrop. Anchoring to the viewport (instead of
 * the bell wrapper) is what prevents the panel from clipping past the
 * left edge on every common phone width — earlier the absolute-positioned
 * 320px panel landed 40-90px past 0 on every iPhone/Pixel/Galaxy because
 * the bell sits ~110px in from the viewport's right edge.
 *
 * Desktop (>768px): keeps the original absolute-positioned panel anchored
 * to the bell — there's room for it there.
 */
export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  // Lock body scroll while the mobile sheet is open so the page underneath
  // doesn't drift while the user is reading the list.
  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, isMobile])

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: 'calc(62px + 8px + env(safe-area-inset-top, 0px))',
        left: 12,
        right: 12,
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(20, 25, 22, 0.18)',
        maxHeight: 'min(72dvh, calc(100vh - 90px - env(safe-area-inset-bottom, 0px)))',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 101,
        animation: 'thalifyNotifSlideIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }
    : {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        width: 360,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 480,
        overflow: 'auto',
        zIndex: 100,
      }

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
        aria-expanded={open}
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

      {open && isMobile && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 25, 22, 0.32)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            zIndex: 100,
            animation: 'thalifyNotifFade 180ms ease-out',
          }}
          aria-hidden="true"
        />
      )}

      {open && (
        <div style={panelStyle} role="dialog" aria-label="Notifications">
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Notifications</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    padding: 4,
                  }}
                >
                  Mark all read
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 22,
                    lineHeight: 1,
                    padding: 4,
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 8,
                  }}
                  aria-label="Close notifications"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div style={{ overflow: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
            {notifications.length === 0 && (
              <div
                style={{
                  padding: 24,
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
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: n.read ? 'transparent' : 'var(--cream)',
                }}
              >
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: 'var(--ink)',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                  }}
                >
                  {n.message}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
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
        </div>
      )}
    </div>
  )
}
