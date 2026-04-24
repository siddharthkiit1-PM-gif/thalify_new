import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const PROD_HOSTS = new Set([
  'thalify.vercel.app',
  'thalify-app.vercel.app',
  'get-thalify.vercel.app',
  'n-beta-flame.vercel.app',
])
const PROD_CONVEX = 'https://coordinated-corgi-211.convex.cloud'
const DEV_CONVEX = 'https://perfect-hornet-293.convex.cloud'

function resolveConvexUrl(): string {
  const envUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (envUrl && envUrl.length > 0) return envUrl
  if (typeof window !== 'undefined' && PROD_HOSTS.has(window.location.hostname)) {
    return PROD_CONVEX
  }
  return DEV_CONVEX
}

const convex = new ConvexReactClient(resolveConvexUrl())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>
)
