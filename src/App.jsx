
import { Navigate, Route, Routes } from 'react-router-dom'

import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SundayReport from './pages/SundayReport'
import Members from './pages/Members'
import Statistics from './pages/Statistics'
import PrintReport from './pages/PrintReport'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sunday-report" element={<SundayReport />} />
        <Route path="/members" element={<Members />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/print-report" element={<PrintReport />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
