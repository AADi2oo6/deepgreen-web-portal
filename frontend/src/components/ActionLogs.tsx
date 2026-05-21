import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error('Failed to fetch cases from server.');
  }

  return response.json();
};
import { 
  Search, 
  Clock, 
  Cpu, 
  AlertTriangle, 
  RefreshCw, 
  FolderKanban,
  User
} from 'lucide-react';

interface CaseItem {
  id: string; // alert_id
  node_id: string;
  threat_type: string;
  confidence_score: number;
  workflow_status: string;
  created_at: string;
  node_name: string | null;
  initiated_by: string;
}

export default function ActionLogs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const token = localStorage.getItem('token');

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR<CaseItem[]>(
    token ? 'http://localhost:8000/api/cases' : null,
    fetcher
  );

  useEffect(() => {
    if (!token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (swrError && swrError.message === 'Unauthorized') {
      navigate('/');
    }
  }, [swrError, navigate]);

  const cases = data || [];

  const isClosed = (status: string) => {
    const lower = (status || '').toLowerCase();
    return lower.includes('closed') || lower.includes('false alarm') || lower.includes('resolved');
  };

  // Filter cases based on search query and status filter
  const filteredCases = cases.filter(item => {
    const matchesSearch = 
      item.threat_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.node_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.node_id.toLowerCase().includes(searchQuery.toLowerCase());

    const closed = isClosed(item.workflow_status);
    if (statusFilter === 'active') {
      return matchesSearch && !closed;
    }
    if (statusFilter === 'closed') {
      return matchesSearch && closed;
    }
    return matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-950 font-sans text-slate-100">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Case Management Center</h1>
              <p className="text-xs text-slate-400 mt-1">Monitor, update, and resolve active ecological threat investigations.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          disabled={isLoading || isValidating}
          className="self-start md:self-auto flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by threat type, node name, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 rounded-2xl text-xs text-white placeholder-slate-500 transition-all outline-none"
          />
        </div>

        <div className="flex bg-slate-900/40 p-1 rounded-2xl border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`py-2.5 px-4 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`py-2.5 px-4 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`py-2.5 px-4 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'closed'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Closed
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Loading cases data...</p>
        </div>
      ) : swrError ? (
        <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-center py-10">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Retrieval Failed</h3>
          <p className="text-xs text-red-400">{swrError.message || 'An unexpected error occurred.'}</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
          <FolderKanban className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-400 mb-1">No Cases Found</h3>
          <p className="text-xs text-slate-500">There are no cases matching the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCases.map((item) => {
            const closed = isClosed(item.workflow_status);
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/actions/${item.id}`)}
                className="group relative flex flex-col justify-between bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 rounded-3xl p-6 shadow-md hover:shadow-emerald-950/10 transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
              >
                {/* Top Header Card */}
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {item.threat_type}
                    </h3>
                    
                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      closed
                        ? 'bg-slate-800 text-slate-400 border border-slate-750'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {closed ? 'Closed' : 'Active'}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="space-y-2.5 my-4">
                    <div className="flex items-center gap-2.5 text-xs text-slate-400">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {item.node_name || `Node ${item.node_id.substring(0, 8)}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        {new Date(item.created_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        Initiated by: <span className="text-slate-300 font-semibold">{item.initiated_by}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="pt-4 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Confidence: <strong className="text-slate-300">{(item.confidence_score * 100).toFixed(1)}%</strong></span>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 group-hover:border-emerald-500/20 group-hover:text-emerald-400 transition-all">
                    View Details
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
