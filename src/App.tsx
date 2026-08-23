import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RecordPage from './pages/RecordPage'
import LibraryPage from './pages/LibraryPage'
import ReviewPage from './pages/ReviewPage'
import ProgressPage from './pages/ProgressPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/progress" element={<ProgressPage />} />
      </Routes>
    </HashRouter>
  )
}
