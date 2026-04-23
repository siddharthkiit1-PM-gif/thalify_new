import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useConvexAuth } from 'convex/react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface Props {
  children: ReactNode
  requireAuth?: boolean
  requireOnboarding?: boolean
}

export default function ProtectedRoute({ children, requireAuth, requireOnboarding }: Props) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const profile = useQuery(api.users.getProfile)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cream)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--sage-100)', borderTopColor: 'var(--sage-700)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (requireOnboarding && isAuthenticated && profile !== undefined && !profile?.onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
