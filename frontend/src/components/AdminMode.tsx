import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';

interface NodeData {
  id: string;
  latitude: number;
  longitude: number;
  monitoring_radius_meters: number;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function AdminMode() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState<L.LatLng | null>(null);
  
  // Form state
  const [nodeId, setNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [radius, setRadius] = useState('500');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');

  const fetchNodes = () => {
    fetch('http://localhost:8000/api/nodes')
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error("Error fetching nodes:", err));
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleMapClick = (latlng: L.LatLng) => {
    setClickedLatLng(latlng);
    setLatStr(latlng.lat.toFixed(5));
    setLngStr(latlng.lng.toFixed(5));
    setNodeId(uuidv4()); // Auto-generate a UUID for convenience
    setNodeName(`Node ${Math.floor(Math.random() * 1000)}`);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId || !radius || !latStr || !lngStr) return;

    try {
      await fetch('http://localhost:8000/api/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: nodeId,
          name: nodeName,
          latitude: parseFloat(latStr),
          longitude: parseFloat(lngStr),
          monitoring_radius_meters: parseFloat(radius)
        })
      });
      
      setShowModal(false);
      fetchNodes(); // Refresh nodes
    } catch (err) {
      console.error("Failed to create node:", err);
    }
  };

  // Custom icon for a normal monitoring node
  const customIcon = L.divIcon({
    className: 'custom-node-icon',
    html: `<div style="background-color: #10b981; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <div className="relative w-full h-full bg-gray-950 text-slate-100">
      {/* Map Container */}
      <MapContainer 
        center={[18.4647, 73.8744]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapClickHandler onMapClick={handleMapClick} />
        
        {nodes.map(node => (
          <div key={node.id}>
            <Circle
              center={[node.latitude, node.longitude]}
              radius={node.monitoring_radius_meters}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
            <Marker 
              position={[node.latitude, node.longitude]}
              icon={customIcon}
            >
              <Popup className="text-gray-900 font-sans">
                <strong>Node ID:</strong> {node.id.substring(0, 8)}...<br/>
                <strong>Radius:</strong> {node.monitoring_radius_meters}m
              </Popup>
            </Marker>
          </div>
        ))}
        
        {/* Render a temporary marker where the user clicked */}
        {showModal && latStr && lngStr && !isNaN(parseFloat(latStr)) && !isNaN(parseFloat(lngStr)) && (
          <Marker 
            position={[parseFloat(latStr), parseFloat(lngStr)]}
            icon={L.divIcon({
              className: 'custom-new-node-icon',
              html: `<div style="background-color: #3b82f6; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          />
        )}
      </MapContainer>

      {/* Deployment Mode Overlay */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
        <div className="backdrop-blur-xl bg-gray-900/80 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] rounded-lg p-3">
          <h2 className="text-emerald-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            Deployment Mode
          </h2>
          <p className="text-xs text-gray-400 mt-1">Click anywhere on the map to deploy a new monitoring node.</p>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && clickedLatLng && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-gray-900 border border-slate-700 shadow-2xl rounded-2xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-xl font-bold text-white mb-4">Deploy New Node</h3>
            
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 uppercase tracking-wider mb-1">Latitude</label>
                  <input 
                    type="number"
                    step="any"
                    value={latStr}
                    onChange={(e) => setLatStr(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 uppercase tracking-wider mb-1">Longitude</label>
                  <input 
                    type="number"
                    step="any"
                    value={lngStr}
                    onChange={(e) => setLngStr(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 uppercase tracking-wider mb-1">Node Name</label>
                <input 
                  type="text" 
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 uppercase tracking-wider mb-1">Node ID (UUID)</label>
                <input 
                  type="text" 
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 uppercase tracking-wider mb-1">Monitoring Radius (Meters)</label>
                <input 
                  type="number" 
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  min="10"
                  max="5000"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded shadow-lg shadow-emerald-900/50 transition-colors focus:outline-none"
                >
                  Deploy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
