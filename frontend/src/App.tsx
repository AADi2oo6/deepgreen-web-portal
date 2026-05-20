import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import Login from './components/Login';
import LiveMap from './components/LiveMap';
import AdminMode from './components/AdminMode';
import { Activity, ShieldAlert, Settings, LogOut } from 'lucide-react';
import './App.css';

// Protected Layout that enforces authentication and wraps routes in the Unified Command Center Header
function ProtectedLayout() {
  const token = localStorage.getItem('token');
  const location = useLocation();
  const navigate = useNavigate();

  // If no auth token is present, redirect to Login portal
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Determine active tab based on active route path
  const activeTab = location.pathname === '/admin' ? 'admin' : 'map';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-950 text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shadow-md z-[2000] relative">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
            DeepGreen Command Center
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50">
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-gray-700 text-white shadow-sm border border-gray-600/50'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
              }`}
            >
              <Activity className="w-4 h-4" />
              Live Map
            </button>
            <button
              onClick={() => navigate('/admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gray-700 text-white shadow-sm border border-gray-600/50'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              Admin Mode
            </button>
          </nav>

          {/* User Profile and Sign Out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-750 hover:bg-red-650 active:bg-red-800 text-white text-xs font-semibold rounded-lg border border-red-500/20 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-red-600/10 active:scale-[0.98]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<LiveMap />} />
          <Route path="/admin" element={<AdminMode />} />
        </Route>
        
        {/* Catch-all Redirection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
