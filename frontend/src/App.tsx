import { useState } from 'react';
import LiveMap from './components/LiveMap';
import { Activity, ShieldAlert, Settings } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'admin'>('map');

  return (
    <div className="flex flex-col w-full h-screen bg-gray-950 text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shadow-md z-10 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
            DeepGreen Command Center
          </h1>
        </div>
        
        <nav className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'map'
                ? 'bg-gray-700 text-white shadow-sm border border-gray-600/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Map
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'admin'
                ? 'bg-gray-700 text-white shadow-sm border border-gray-600/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            Admin Mode
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {activeTab === 'map' && <LiveMap />}
        {activeTab === 'admin' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Settings className="w-16 h-16 text-gray-700 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-500">Admin Mode Dashboard</h2>
              <p className="text-gray-600">Configuration and threat management interface coming soon.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
