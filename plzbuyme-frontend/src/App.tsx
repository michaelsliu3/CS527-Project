import { Routes, Route } from 'react-router-dom'
import { Box } from '@chakra-ui/react'

function Placeholder({ name }: { name: string }) {
  return <Box p={4}>{name} (placeholder)</Box>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder name="HomePage" />} />
      <Route path="/login" element={<Placeholder name="LoginPage" />} />
      <Route path="/register" element={<Placeholder name="RegisterPage" />} />
      <Route path="/auctions" element={<Placeholder name="AuctionListPage" />} />
      <Route path="/auctions/create" element={<Placeholder name="CreateAuctionPage" />} />
      <Route path="/auctions/:id" element={<Placeholder name="AuctionDetailPage" />} />
      <Route path="/my-auctions" element={<Placeholder name="MyAuctionsPage" />} />
      <Route path="/alerts" element={<Placeholder name="AlertsPage" />} />
      <Route path="/notifications" element={<Placeholder name="NotificationsPage" />} />
      <Route path="/questions" element={<Placeholder name="QuestionsPage" />} />
      <Route path="/profile" element={<Placeholder name="ProfilePage" />} />
      <Route path="/rep/*" element={<Placeholder name="RepDashboard" />} />
      <Route path="/admin/*" element={<Placeholder name="AdminDashboard" />} />
    </Routes>
  )
}

export default App
