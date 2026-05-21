import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { 
  Map, 
  Settings, 
  Radio, 
  Layers, 
  PlusCircle, 
  Users, 
  LogOut, 
  Activity, 
  FileText,
  BadgeAlert,
  IdCard,
  Phone,
  MapPin,
  X
} from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  full_name: string;
  rank: string;
  role: string;
  contact_number?: string;
  government_id?: string;
  address?: string;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<UserData | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Failed to parse user data from localStorage", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const currentPath = location.pathname;
  const currentTool = searchParams.get('tool') || 'inspect';
  const currentTab = searchParams.get('tab') || 'map';

  const navigateToAdminTool = (toolName: string) => {
    navigate(`/admin?tool=${toolName}`);
  };

  const navigateToDashboardTab = (tabName: string) => {
    navigate(`/dashboard?tab=${tabName}`);
  };

  return (
    <>
      <aside className="w-72 h-screen bg-gray-900 border-r border-slate-800 flex flex-col justify-between text-slate-300 font-sans z-[1000] relative">
        {/* Top Header Section */}
        <div>
          <div className="flex items-center justify-center px-4 py-5 border-b border-slate-800/80">
            <img src={logoImg} alt="DeepGreen Command Center" className="h-12 w-auto object-contain" />
          </div>

          {/* Mode Switcher Toggle for Admin */}
          {isAdmin && (
            <div className="px-4 pt-4">
              <div className="flex bg-gray-950/60 p-1.5 rounded-xl border border-slate-800/80">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    currentPath === '/dashboard'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  Live Map
                </button>
                <button
                  onClick={() => navigate('/admin?tool=inspect')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    currentPath === '/admin'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Admin Panel
                </button>
              </div>
            </div>
          )}

          {/* Role Navigation Menu Lists */}
          <nav className="px-4 py-6 space-y-1.5">
            {isAdmin ? (
              // Admin Sidebar Tools
              currentPath === '/admin' ? (
                <>
                  <div className="px-2 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Admin Map Operations
                  </div>
                  <button
                    onClick={() => navigateToAdminTool('node')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentTool === 'node'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Deploy Node
                  </button>
                  <button
                    onClick={() => navigateToAdminTool('inspect')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentTool === 'inspect'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    Manage Nodes
                  </button>
                  <button
                    onClick={() => navigateToAdminTool('area')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentTool === 'area'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Mark Forest Area
                  </button>
                  <div className="px-2 pt-4 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Official Administration
                  </div>
                  <button
                    onClick={() => navigateToAdminTool('accounts')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentTool === 'accounts'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Manage Accounts
                  </button>
                </>
              ) : (
                <>
                  <div className="px-2 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Monitor
                  </div>
                  <button
                    onClick={() => navigateToDashboardTab('map')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentPath === '/dashboard' && currentTab === 'map'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    Live Map View
                  </button>
                  <button
                    onClick={() => navigate('/activities')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentPath === '/activities'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    View Activities
                  </button>
                  <button
                    onClick={() => navigate('/actions')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      currentPath.startsWith('/actions')
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Action Logs
                  </button>
                </>
              )
            ) : (
              // Normal Official Sidebar Menu
              <>
                <div className="px-2 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Official Monitoring
                </div>
                <button
                  onClick={() => navigateToDashboardTab('map')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentPath === '/dashboard' && currentTab === 'map'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  Live Map
                </button>
                <button
                  onClick={() => navigate('/activities')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentPath === '/activities'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  View Activities
                </button>
                <button
                  onClick={() => navigate('/actions')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentPath.startsWith('/actions')
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-250 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Action Logs
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Profile Section at Bottom */}
        <div className="p-4 border-t border-slate-800/80">
          <div 
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center gap-3 p-2.5 bg-slate-950/40 border border-slate-800 rounded-2xl hover:bg-slate-800/50 hover:border-slate-700/80 transition-all cursor-pointer"
          >
            {/* Dummy Profile Avatar */}
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shadow-inner bg-gradient-to-br from-emerald-600 to-teal-800 text-sm">
              {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'GO'}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-white truncate">
                {user.full_name}
              </h3>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                {user.rank}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-red-950/30 text-slate-500 hover:text-red-400 border border-slate-850 hover:border-red-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Official Government ID Details Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-gray-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            
            {/* Close Button */}
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-750 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Shield Logo header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/80">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <IdCard className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-md font-bold text-white">Government Credentials</h3>
                <p className="text-[9px] text-emerald-500/80 uppercase font-bold tracking-wider">Official Security Access Profile</p>
              </div>
            </div>

            {/* Profile Info Details Grid */}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Official Name</span>
                <span className="col-span-2 text-slate-200 font-bold">{user.full_name}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Username</span>
                <span className="col-span-2 text-slate-200 font-mono">{user.username}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Access Rank</span>
                <span className="col-span-2 text-slate-200 font-semibold">{user.rank}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Role Access</span>
                <span className="col-span-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    user.role === 'admin' 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  }`}>
                    {user.role}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Government ID</span>
                <span className="col-span-2 text-slate-200 font-mono font-semibold">
                  {user.government_id || 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-800/40">
                <span className="text-xs text-slate-500 font-semibold uppercase">Contact No.</span>
                <span className="col-span-2 text-slate-200 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {user.contact_number || 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5">
                <span className="text-xs text-slate-500 font-semibold uppercase">Post Address</span>
                <span className="col-span-2 text-slate-300 text-xs flex items-start gap-1.5 leading-relaxed">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  {user.address || 'N/A'}
                </span>
              </div>
            </div>

            {/* Note Footer */}
            <div className="mt-6 p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-[10px] text-slate-500 flex gap-2">
              <BadgeAlert className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>This credential metadata signature matches active government authorization tables. Access logs are archived.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
