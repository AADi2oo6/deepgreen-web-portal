import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Send, 
  Upload, 
  AlertTriangle, 
  Cpu, 
  Clock,
  X
} from 'lucide-react';

interface CaseItem {
  id: string;
  node_id: string;
  threat_type: string;
  confidence_score: number;
  workflow_status: string;
  created_at: string;
  node_name: string | null;
}

interface CaseUpdate {
  id: string;
  alert_id: string;
  officer_username: string;
  report_text: string;
  image_path: string | null;
  created_at: string;
}

export default function CaseDetails() {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  
  const [caseMeta, setCaseMeta] = useState<CaseItem | null>(null);
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [reportText, setReportText] = useState('');
  const [closeCase, setCloseCase] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('token');

  const fetchData = async () => {
    if (!alertId || !token) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch case metadata from /api/cases
      const metaResponse = await fetch('http://localhost:8000/api/cases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!metaResponse.ok) throw new Error('Failed to fetch case list.');
      const metaData = await metaResponse.json();
      const currentCase = metaData.find((c: any) => c.id === alertId);
      
      if (!currentCase) {
        throw new Error('Case details not found or case is pending review.');
      }
      setCaseMeta(currentCase);

      // 2. Fetch updates timeline
      const updatesResponse = await fetch(`http://localhost:8000/api/cases/${alertId}/updates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!updatesResponse.ok) throw new Error('Failed to fetch case timeline.');
      const updatesData = await updatesResponse.json();
      setUpdates(updatesData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
      return;
    }
    fetchData();
  }, [alertId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertId || !token || !reportText.trim()) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('report_text', reportText);
    formData.append('close_case', closeCase ? 'true' : 'false');
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const response = await fetch(`http://localhost:8000/api/cases/${alertId}/updates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to submit field report.');
      }

      // Reset form
      setReportText('');
      setCloseCase(false);
      handleRemoveImage();

      // Refresh data
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error submitting report.');
    } finally {
      setSubmitting(false);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:8000${cleanPath}`;
  };

  const isCaseClosed = caseMeta && (
    caseMeta.workflow_status.toLowerCase().includes('closed') ||
    caseMeta.workflow_status.toLowerCase().includes('false alarm') ||
    caseMeta.workflow_status.toLowerCase().includes('resolved')
  );

  if (loading && !caseMeta) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-slate-100 py-20 gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500">Loading case details...</p>
      </div>
    );
  }

  if (error || !caseMeta) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-950 text-slate-100 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-red-950/20 border border-red-500/20 rounded-3xl text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h3 className="text-md font-bold text-white mb-2">Error Loading Case</h3>
          <p className="text-xs text-red-400 mb-6">{error || 'Case details could not be found.'}</p>
          <button
            onClick={() => navigate('/actions')}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-950 font-sans text-slate-100">
      {/* Back navigation & Header */}
      <div className="flex flex-col gap-4 mb-8 pb-6 border-b border-slate-800/80">
        <div>
          <button
            onClick={() => navigate('/actions')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Case Center</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {caseMeta.threat_type}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isCaseClosed
                  ? 'bg-slate-850 text-slate-400 border border-slate-800'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              }`}>
                {caseMeta.workflow_status}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Initiated on {new Date(caseMeta.created_at).toLocaleString()}</span>
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-900/30 border border-slate-850 rounded-2xl p-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Sensor Node</span>
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate max-w-[120px]">{caseMeta.node_name || caseMeta.node_id.substring(0, 8)}</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Classification Conf.</span>
              <p className="text-xs font-bold text-slate-200 mt-0.5">
                {(caseMeta.confidence_score * 100).toFixed(1)}%
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Status Class</span>
              <p className={`text-xs font-bold mt-0.5 ${isCaseClosed ? 'text-slate-400' : 'text-emerald-400'}`}>
                {isCaseClosed ? 'Resolved / Closed' : 'Active Investigation'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Timeline Column */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Chronological Investigation Timeline</h2>
          
          {updates.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10">
              <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-400 mb-1">No Updates Logged</h3>
              <p className="text-[11px] text-slate-500">Submit the first field report to document observations.</p>
            </div>
          ) : (
            <div className="relative border-l border-slate-800 ml-4 pl-8 space-y-8 py-2">
              {updates.map((update, index) => (
                <div key={update.id} className="relative">
                  {/* Timeline Dot Marker */}
                  <span className="absolute -left-[42px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 shadow-md">
                    {index + 1}
                  </span>

                  <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-5 hover:border-slate-800 transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850/50 pb-3 mb-3 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-350">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{update.officer_username}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(update.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {update.report_text}
                    </p>

                    {update.image_path && (
                      <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40 max-w-md">
                        <img 
                          src={getImageUrl(update.image_path)} 
                          alt="Field Investigation Evidence" 
                          className="w-full h-auto object-cover max-h-[300px] hover:scale-[1.02] transition-transform duration-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Report Form Column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Log Action / Field Report</h2>
            
            <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Details text area */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Observation Report Details
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Provide details about active field patrol findings, threats identified, or mitigation actions taken..."
                    className="w-full p-4 bg-slate-950/60 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 rounded-2xl text-xs text-slate-200 placeholder-slate-650 transition-all outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Evidence Image Upload */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Evidence Photo (Optional)
                  </label>
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    className="hidden"
                    id="evidence-photo-upload"
                  />

                  {imagePreview ? (
                    <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
                      <img 
                        src={imagePreview} 
                        alt="Evidence Upload Preview" 
                        className="w-full h-auto max-h-[180px] object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2.5 right-2.5 p-1 bg-slate-900/80 hover:bg-red-950/80 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center py-6 px-4 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/40 rounded-2xl transition-all cursor-pointer group"
                    >
                      <Upload className="w-5 h-5 text-slate-500 group-hover:text-slate-350 mb-2 transition-colors" />
                      <span className="text-xs text-slate-400 font-semibold group-hover:text-slate-200 transition-colors">Upload Field Photo</span>
                      <span className="text-[10px] text-slate-600 mt-1">PNG, JPG, JPEG up to 10MB</span>
                    </button>
                  )}
                </div>

                {/* Close Case Checkbox */}
                <div className="flex items-start gap-3 bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <input
                    type="checkbox"
                    id="close_case_checkbox"
                    checked={closeCase}
                    onChange={(e) => setCloseCase(e.target.checked)}
                    disabled={isCaseClosed || false}
                    className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-slate-900 bg-slate-950 accent-emerald-500 shrink-0 mt-0.5 cursor-pointer disabled:opacity-50"
                  />
                  <label htmlFor="close_case_checkbox" className="select-none cursor-pointer">
                    <span className="block text-xs font-bold text-slate-300">Mark Case as Closed</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      {isCaseClosed 
                        ? 'This case has already been resolved and closed.' 
                        : 'Sets workflow status to Closed - Resolved and notifies team.'}
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting || !reportText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/40 border border-emerald-500/20 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-emerald-950/15"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Field Report</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
