import { Routes, Route } from 'react-router-dom'
import Waitlist from './pages/Waitlist'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Waitlist />} />
      <Route path="/waitlist" element={<Waitlist />} />
    </Routes>
  )
}
