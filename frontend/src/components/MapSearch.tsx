import { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { Search, Cpu, TreePine, X, Loader2 } from 'lucide-react';

interface SearchItem {
  type: 'node' | 'zone';
  id: string;
  name: string;
  coordinates: [number, number] | null;
  details?: {
    monitoring_radius_meters?: number;
  };
}

export default function MapSearch() {
  const map = useMap();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8000/api/search')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('Error fetching search indices:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = searchQuery.trim() === '' 
    ? [] 
    : items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelect = (item: SearchItem) => {
    if (item.coordinates && item.coordinates.length === 2) {
      map.flyTo(item.coordinates, 15, {
        duration: 1.5
      });
    }
    setSearchQuery(item.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-[340px] sm:w-[420px] pointer-events-auto"
    >
      <div className="relative flex items-center bg-gray-900/90 backdrop-blur-xl border border-slate-700/60 shadow-2xl rounded-2xl p-1.5 transition-all focus-within:border-emerald-500/50 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <div className="pl-3 text-slate-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search nodes or forest zones..."
          className="w-full bg-transparent border-0 outline-none px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:ring-0"
        />

        {searchQuery && (
          <button 
            onClick={handleClear}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer mr-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && filteredItems.length > 0 && (
        <div className="absolute top-[105%] left-0 w-full bg-gray-900/95 backdrop-blur-xl border border-slate-750 shadow-2xl rounded-2xl mt-1.5 overflow-hidden max-h-60 overflow-y-auto z-[2000] divide-y divide-slate-800/40">
          {filteredItems.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/80 transition-all group cursor-pointer"
            >
              <div className={`p-2 rounded-xl border ${
                item.type === 'node' 
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {item.type === 'node' ? (
                  <Cpu className="w-4 h-4 group-hover:scale-110 transition-transform" />
                ) : (
                  <TreePine className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                  {item.name}
                </div>
                <div className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-0.5 capitalize flex items-center gap-1">
                  <span>{item.type}</span>
                  {item.coordinates && (
                    <span className="font-mono text-[9px] text-slate-600 group-hover:text-slate-500">
                      ({item.coordinates[0].toFixed(4)}, {item.coordinates[1].toFixed(4)})
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchQuery.trim() !== '' && filteredItems.length === 0 && (
        <div className="absolute top-[105%] left-0 w-full bg-gray-900/95 backdrop-blur-xl border border-slate-750 shadow-2xl rounded-2xl mt-1.5 p-4 text-center text-xs text-slate-500 z-[2000]">
          No matches found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}
