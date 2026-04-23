import { useState, useEffect } from 'react'

export default function OfflineToast() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1c1917', color: 'white', padding: '10px 20px', borderRadius: 99, fontSize: 13, zIndex: 1000 }}>
      You're offline. Check your connection.
    </div>
  )
}
