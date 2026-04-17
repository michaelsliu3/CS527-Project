import { useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { Routes, Route, Navigate, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { setAuthRedirect } from './api/authRedirect'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProfilePage } from './pages/ProfilePage'
import { AuctionListPage } from './pages/AuctionListPage'
import { AuctionDetailPage } from './pages/AuctionDetailPage'
import { SellItemModalProvider } from './context/SellItemModalContext'
import { MyAuctionsPage } from './pages/MyAuctionsPage'
import { AlertsPage } from './pages/AlertsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { QuestionsPage } from './pages/QuestionsPage'
import { RepDashboard } from './pages/rep/RepDashboard'
import { ReportsPage } from './pages/admin/ReportsPage'
import { UserParticipationHistoryPage } from './pages/UserParticipationHistoryPage'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const backgroundLocation = location.state && (location.state as { backgroundLocation?: unknown }).backgroundLocation
  useEffect(() => {
    setAuthRedirect(() => () => navigate('/login'))
    return () => setAuthRedirect(null)
  }, [navigate])

  return (
    <SellItemModalProvider>
      <>
      <Box
        filter={backgroundLocation ? 'blur(8px)' : undefined}
        pointerEvents={backgroundLocation ? 'none' : 'auto'}
        transition="filter 0.15s ease"
      >
        <Routes location={backgroundLocation || location}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/auctions" element={<AuctionListPage />} />
            <Route path="/auctions/create" element={<Navigate to="/auctions" replace />} />
            <Route path="/auctions/:id" element={<AuctionDetailPage />} />
            <Route
              path="/my-auctions"
              element={
                <ProtectedRoute roles={['end_user', 'vip', 'customer_rep', 'admin']}>
                  <MyAuctionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute roles={['end_user', 'vip', 'customer_rep', 'admin']}>
                  <AlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/questions"
              element={
                <ProtectedRoute>
                  <QuestionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/questions/:questionId"
              element={
                <ProtectedRoute>
                  <QuestionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:userId/history"
              element={
                <ProtectedRoute>
                  <UserParticipationHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rep/*"
              element={
                <ProtectedRoute roles={['customer_rep', 'admin']}>
                  <RepDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<ReportsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="gm" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>

      {backgroundLocation && (
        <Routes>
          <Route path="/auctions/:id" element={<AuctionDetailPage />} />
        </Routes>
      )}
      </>
    </SellItemModalProvider>
  )
}

export default App
