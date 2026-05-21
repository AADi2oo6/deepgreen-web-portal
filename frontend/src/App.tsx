import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import LiveMap from './components/LiveMap';
import AdminMode from './components/AdminMode';
import ViewActivities from './components/ViewActivities';
import ActionLogs from './components/ActionLogs';
import CaseDetails from './components/CaseDetails';
import DashboardLayout from './layouts/DashboardLayout';
import './App.css';

// ProtectedRoute helper component to gate routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/" replace />;
}

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
          <Route path="/activities" element={<ViewActivities />} />
          <Route path="/actions" element={
            <ProtectedRoute>
              <ActionLogs />
            </ProtectedRoute>
          } />
          <Route path="/actions/:alertId" element={
            <ProtectedRoute>
              <CaseDetails />
            </ProtectedRoute>
          } />
        </Route>
        
        {/* Catch-all Fallback Redirection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


