import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProfilePage } from './pages/ProfilePage'

function Placeholder({ name }: { name: string }) {
  return <div style={{ color: '#d4d4d8', padding: '2rem', textAlign: 'center' }}>{name} (placeholder)</div>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/auctions" element={<Placeholder name="AuctionListPage" />} />
        <Route path="/auctions/create" element={<Placeholder name="CreateAuctionPage" />} />
        <Route path="/auctions/:id" element={<Placeholder name="AuctionDetailPage" />} />
        <Route
          path="/my-auctions"
          element={
            <ProtectedRoute roles={['end_user']}>
              <Placeholder name="MyAuctionsPage" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute roles={['end_user']}>
              <Placeholder name="AlertsPage" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Placeholder name="NotificationsPage" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/questions"
          element={
            <ProtectedRoute>
              <Placeholder name="QuestionsPage" />
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
