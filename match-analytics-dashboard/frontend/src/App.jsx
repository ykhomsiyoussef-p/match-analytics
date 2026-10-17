import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MyMatches from './pages/MyMatches.jsx'
import NewMatch from './pages/NewMatch.jsx'
import DataImport from './pages/DataImport.jsx'
import VideoAnalysis from './pages/VideoAnalysis.jsx'
import MatchStats from './pages/MatchStats.jsx'
import PlayerPerformance from './pages/PlayerPerformance.jsx'
import Reports from './pages/Reports.jsx'
import ReportDetail from './pages/ReportDetail.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/matchs" element={<MyMatches />} />
          <Route path="/matchs/nouveau" element={<NewMatch />} />
          <Route path="/matchs/:id" element={<Dashboard />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/video" element={<VideoAnalysis />} />
          <Route path="/statistiques" element={<MatchStats />} />
          <Route path="/joueurs" element={<PlayerPerformance />} />
          <Route path="/rapports" element={<Reports />} />
          <Route path="/rapports/:id" element={<ReportDetail />} />
          <Route path="/parametres" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}
