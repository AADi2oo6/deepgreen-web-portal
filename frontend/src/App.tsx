import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import LiveMap from './components/LiveMap';
import AdminMode from './components/AdminMode';
import DashboardLayout from './layouts/DashboardLayout';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Secure Access Login Portal */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Dashboard Shell Layout with left sidebar */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<LiveMap />} />
          <Route path="/admin" element={<AdminMode />} />
        </Route>
        
        {/* Catch-all Fallback Redirection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
