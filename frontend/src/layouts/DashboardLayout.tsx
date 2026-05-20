import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout() {
  const token = localStorage.getItem('token');

  // If no auth token is present, redirect to Login portal
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex w-full h-screen bg-gray-950 text-slate-100 overflow-hidden">
      {/* Role-based Left Sidebar */}
      <Sidebar />

      {/* Right Side Main Content Panel */}
      <main className="flex-1 h-full relative overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
