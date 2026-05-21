import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Clock, 
  Cpu, 
  User, 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  Inbox,
  X,
  MapPin
} from 'lucide-react';

interface AuditLog {
  id: string;
  alert_id: string | null;
  action_taken: string;
  performed_by_username: string | null;
  timestamp: string;
  notes: string | null;
  threat_type: string | null;
  confidence_score: number | null;
  node_id: string | null;
  node_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function ViewActivities() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Take Action Modal States
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState('Field Visit Initiated');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');
    
    if (!token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs from server.');
      }

      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleOpenActionModal = (log: AuditLog) => {
    setSelectedLog(log);
    setActionType('Field Visit Initiated');
    setRemarks('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog || !selectedLog.alert_id) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setSubmitting(true);
      const response = await fetch(`http://localhost:8000/api/alerts/${selectedLog.alert_id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action_type: actionType,
          notes: remarks
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit alert action.');
      }

      handleCloseModal();
      await fetchLogs();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit action. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getActionBadgeStyles = (action: string) => {
    const act = action.trim().toLowerCase();
    if (act.includes('false alarm') || act === 'resolved' || act.includes('nothing found')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    } else if (act.includes('escalat') || act === 'triggered' || act === 'critical' || act.includes('field visit')) {
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    } else if (act.includes('auto-logged') || act.includes('telemetry')) {
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    } else {
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  const getThreatBadgeStyles = (threat: string | null) => {
    if (!threat) return 'text-slate-500 italic';
    const t = threat.toLowerCase();
    if (t.includes('chainsaw')) return 'text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20';
    if (t.includes('fire')) return 'text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20';
    if (t.includes('gunshot')) return 'text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20';
    return 'text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20';
  };

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    const nodeId = (log.node_id || '').toLowerCase();
    const nodeName = (log.node_name || '').toLowerCase();
    const personnel = (log.performed_by_username || '').toLowerCase();
    const action = (log.action_taken || '').toLowerCase();
    const threat = (log.threat_type || '').toLowerCase();
    const notes = (log.notes || '').toLowerCase();

    return nodeId.includes(query) || 
           nodeName.includes(query) ||
           personnel.includes(query) || 
           action.includes(query) || 
           threat.includes(query) || 
           notes.includes(query);
  });

  return (
    <div className="flex-1 h-full flex flex-col bg-gray-950 text-slate-100 font-sans p-6 overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">System Activity Logs</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time auditable history of environmental threat classifications, alerts, and officer response actions.
          </p>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="mb-6">
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </span>
          <input
            type="text"
            placeholder="Filter logs by Node ID, Name, Personnel, Threat, or Action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/60 text-slate-200 placeholder-slate-500 text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        {loading ? (
          // Loading Shimmer State
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <span className="text-xs text-slate-500">Querying database audit logs...</span>
          </div>
        ) : error ? (
          // Error State
          <div className="flex-1 flex flex-col justify-center items-center py-20 px-4 text-center">
            <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Retrieval Failed</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-750 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          // Empty State
          <div className="flex-1 flex flex-col justify-center items-center py-20 text-center">
            <div className="p-3 bg-slate-850 rounded-full border border-slate-800 text-slate-500 mb-4">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">No Activity Records</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              {searchQuery ? 'No log entries match your active filter parameters.' : 'No audit trail logs are currently stored in the system database.'}
            </p>
          </div>
        ) : (
          // Data Table
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-4 px-5 select-none">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Date/Time
                    </div>
                  </th>
                  <th className="py-4 px-5 select-none">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                      Node ID
                    </div>
                  </th>
                  <th className="py-4 px-5 select-none">Node Name</th>
                  <th className="py-4 px-5 select-none">Threat Type</th>
                  <th className="py-4 px-5 select-none text-right">Confidence</th>
                  <th className="py-4 px-5 select-none">Action Taken</th>
                  <th className="py-4 px-5 select-none">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Personnel In Charge
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-800/20 transition-colors group"
                  >
                    {/* Date / Time */}
                    <td className="py-4.5 px-5 font-medium text-slate-300">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </td>
                    
                    {/* Node ID */}
                    <td className="py-4.5 px-5">
                      {log.node_id ? (
                        <span 
                          title={log.node_id}
                          className="font-mono text-[10px] bg-slate-950/60 border border-slate-850 text-slate-400 px-2 py-1 rounded-lg select-all group-hover:border-slate-800 transition-colors"
                        >
                          {log.node_id.substring(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-slate-600">N/A</span>
                      )}
                    </td>

                    {/* Node Name */}
                    <td className="py-4.5 px-5 text-slate-300 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{log.node_name || 'N/A'}</span>
                        {log.node_id && (
                          <button
                            onClick={() => navigate(`/dashboard?locate=${log.node_id}`)}
                            title="Locate on Map"
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Threat Type */}
                    <td className="py-4.5 px-5">
                      <span className={getThreatBadgeStyles(log.threat_type)}>
                        {log.threat_type || 'N/A'}
                      </span>
                    </td>

                    {/* Confidence Score */}
                    <td className="py-4.5 px-5 text-right font-mono font-semibold text-slate-300">
                      {log.confidence_score !== null && log.confidence_score !== undefined ? (
                        `${(log.confidence_score * 100).toFixed(1)}%`
                      ) : (
                        <span className="text-slate-600 font-normal font-sans">N/A</span>
                      )}
                    </td>

                    {/* Action Taken */}
                    <td className="py-4.5 px-5">
                      {log.action_taken === 'Action Pending' ? (
                        <button
                          onClick={() => handleOpenActionModal(log)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-emerald-950/50 hover:scale-[1.02] cursor-pointer"
                        >
                          Take Action
                        </button>
                      ) : (
                        <>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getActionBadgeStyles(log.action_taken)}`}>
                            {log.action_taken}
                          </span>
                          {log.notes && (
                            <div className="text-[10px] text-slate-500 mt-1 max-w-xs truncate group-hover:text-slate-400 transition-colors" title={log.notes}>
                              {log.notes}
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Personnel */}
                    <td className={`py-4.5 px-5 font-medium select-all ${log.performed_by_username ? 'text-slate-400' : 'text-slate-600 italic'}`}>
                      {log.performed_by_username || 'Action Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Take Action Modal Component */}
      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Resolve Alert Action</h2>
              </div>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Modal Form */}
            <form onSubmit={handleActionSubmit} className="p-6 flex flex-col gap-4">
              <div className="text-xs text-slate-400 bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 space-y-1.5">
                <span className="font-bold text-slate-300 block mb-1">Target Alert Metadata:</span>
                <div>Threat Type: <span className="text-rose-400 font-semibold">{selectedLog.threat_type || 'N/A'}</span></div>
                <div>Node Location: <span className="text-slate-300">{selectedLog.node_name || 'N/A'}</span> <span className="text-slate-500">({selectedLog.node_id?.substring(0, 8)}...)</span></div>
                <div>Confidence Score: <span className="font-semibold text-slate-300 font-mono">{(selectedLog.confidence_score ? selectedLog.confidence_score * 100 : 0).toFixed(1)}%</span></div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Action Taken
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="Field Visit Initiated">Field Visit Initiated</option>
                  <option value="Reviewed - Nothing Found">Reviewed - Nothing Found</option>
                  <option value="Marked as False Alarm">Marked as False Alarm</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Remarks / Observations
                </label>
                <textarea
                  placeholder="Describe details of resolution, field findings, or observations..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all resize-none placeholder-slate-600"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-750 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md hover:shadow-emerald-950/30"
                >
                  {submitting ? 'Submitting...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
