import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ControlPage from './pages/control/index'
import ScreenOutput from './pages/output/ScreenOutput'
import LowerThirdOutput from './pages/output/LowerThirdOutput'
import TickerOutput from './pages/output/TickerOutput'
import StreamHealth from './pages/stream-health/index'
import LoginPage from './pages/login/index'
import AdminPage from './pages/admin/index'
import GoogleCallback from './pages/auth/GoogleCallback'

function ScreenOutputDynamic() {
  const { screenId } = useParams<{ screenId: string }>()
  return <ScreenOutput screen={screenId ?? 'welcome'} />
}

// Redirect to login if not authenticated
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [user, loading, navigate])
  if (loading) return <div className="auth-loading"><span className="msym spin">refresh</span></div>
  if (!user) return null
  return <>{children}</>
}

// Redirect to /control if not an admin
function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin') navigate('/control', { replace: true })
  }, [profile, loading, navigate])
  if (loading) return null
  if (!profile || profile.role !== 'admin') return null
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected studio routes */}
      <Route path="/control" element={<RequireAuth><ControlPage /></RequireAuth>} />
      <Route path="/stream-health" element={<RequireAuth><StreamHealth /></RequireAuth>} />

      {/* Admin only */}
      <Route path="/admin/*" element={<RequireAuth><RequireAdmin><AdminPage /></RequireAdmin></RequireAuth>} />

      {/* Google OAuth callback */}
      <Route path="/auth/google/callback" element={<GoogleCallback />} />

      {/* Output pages — no auth required (OBS browser sources) */}
      <Route path="/output/welcome" element={<ScreenOutput screen="welcome" />} />
      <Route path="/output/screen/:screenId" element={<ScreenOutputDynamic />} />
      <Route path="/output/lower-third" element={<LowerThirdOutput />} />
      <Route path="/output/ticker" element={<TickerOutput />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
