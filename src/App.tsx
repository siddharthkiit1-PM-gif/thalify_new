import { Routes, Route, Navigate } from 'react-router-dom'
import OfflineToast from './components/OfflineToast'
import Waitlist from './pages/Waitlist'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Scan from './pages/Scan'
import Chat from './pages/Chat'
import Family from './pages/Family'
import Lab from './pages/Lab'
import Patterns from './pages/Patterns'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Waitlist />} />
      <Route path="/waitlist" element={<Waitlist />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={
        <ProtectedRoute requireAuth>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/scan" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Scan />
        </ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Chat />
        </ProtectedRoute>
      } />
      <Route path="/family" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Family />
        </ProtectedRoute>
      } />
      <Route path="/lab" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Lab />
        </ProtectedRoute>
      } />
      <Route path="/patterns" element={
        <ProtectedRoute requireAuth requireOnboarding>
          <Patterns />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute requireAuth>
          <Admin />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <OfflineToast />
    </>
  )
}
