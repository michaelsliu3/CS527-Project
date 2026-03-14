import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { setAuthRedirect } from './api/authRedirect'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProfilePage } from './pages/ProfilePage'
import { AuctionListPage } from './pages/AuctionListPage'
import { AuctionDetailPage } from './pages/AuctionDetailPage'
import { CreateAuctionPage } from './pages/CreateAuctionPage'
import { MyAuctionsPage } from './pages/MyAuctionsPage'
import { AlertsPage } from './pages/AlertsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { QuestionsPage } from './pages/QuestionsPage'

function Placeholder({ name }: { name: string }) {
  return <div style={{ color: '#d4d4d8', padding: '2rem', textAlign: 'center' }}>{name} (placeholder)</div>
}

function App() {
  const navigate = useNavigate()
  useEffect(() => {
    setAuthRedirect(() => () => navigate('/login'))
    return () => setAuthRedirect(null)
  }, [navigate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/auctions" element={<AuctionListPage />} />
        <Route
          path="/auctions/create"
          element={
            <ProtectedRoute roles={['end_user']}>
              <CreateAuctionPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auctions/:id" element={<AuctionDetailPage />} />
        <Route
          path="/my-auctions"
          element={
            <ProtectedRoute roles={['end_user']}>
              <MyAuctionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute roles={['end_user']}>
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
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rep/*"
          element={
            <ProtectedRoute roles={['customer_rep', 'admin']}>
              <Placeholder name="RepDashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <Placeholder name="AdminDashboard" />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
