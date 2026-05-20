import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, FeatureGroup, GeoJSON, LayersControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { calculatePolygonArea, formatArea } from '../utils/geoUtils';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MousePointer, PlusCircle, PenTool, Trash2 } from 'lucide-react';


interface NodeData {
  id: string;
  name?: string;
  latitude: number;
  longitude: number;
  monitoring_radius_meters: number;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick, active }: { onMapClick: (latlng: L.LatLng) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick(e.latlng);
      }
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

  const [adminMode, setAdminMode] = useState<'inspect' | 'node' | 'area'>('inspect');
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [forestZones, setForestZones] = useState<any[]>([]);

  const handleModeChange = (mode: 'inspect' | 'node' | 'area') => {
    setAdminMode(mode);
    setDrawnGeometry(null); // Clear unsaved drawing on mode change
  };

  const handleDrawCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon' || layerType === 'rectangle') {
      const geojson = layer.toGeoJSON();
      console.log("Extracted GeoJSON coordinates:", geojson.geometry.coordinates);
      setDrawnGeometry(geojson.geometry);
    }
  };

  const handleSaveBoundary = async () => {
    if (!drawnGeometry) return;
    const zoneName = prompt("Enter a name for this forest zone:", "Protected Forest Zone");
    if (!zoneName) return;

    try {
      const response = await fetch('http://localhost:8000/api/forest-zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone_name: zoneName,
          boundary_geom: drawnGeometry
        })
      });
      if (response.ok) {
        alert("Forest zone saved successfully!");
        setDrawnGeometry(null);
        fetchForestZones();
      } else {
        const err = await response.json();
        alert(`Failed to save: ${err.detail || 'Unknown error'}`);
      }

    } catch (err) {
      console.error("Error saving forest zone:", err);
      alert("Error saving forest zone.");
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Are you sure you want to delete this monitoring node and all its associated alerts?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/nodes/${nodeId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert("Node deleted successfully.");
        fetchNodes();
      } else {
        const err = await response.json();
        alert(`Failed to delete node: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error deleting node:", err);
      alert("Error deleting node.");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this protected forest zone?")) return;
    try {
      const response = await fetch(`http://localhost:8000/api/forest-zones/${zoneId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert("Forest zone deleted successfully.");
        fetchForestZones();
      } else {
        const err = await response.json();
        alert(`Failed to delete forest zone: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error deleting forest zone:", err);
      alert("Error deleting forest zone.");
    }
  };

  const fetchNodes = () => {
    fetch('http://localhost:8000/api/nodes')
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error("Error fetching nodes:", err));
  };

  const fetchForestZones = () => {
    fetch('http://localhost:8000/api/forest-zones')
      .then(res => res.json())
      .then(data => setForestZones(data))
      .catch(err => console.error("Error fetching forest zones:", err));
  };

  useEffect(() => {
    fetchNodes();
    fetchForestZones();
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
    html: `<div style="background-color: #06b6d4; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <div className={`relative w-full h-full bg-gray-950 text-slate-100 ${adminMode === 'node' ? 'mode-node-active' : ''}`}>
      {/* Map Container */}
      <MapContainer 
        center={[18.4647, 73.8744]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Mode">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite View">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        <MapClickHandler onMapClick={handleMapClick} active={adminMode === 'node'} />
        
        {nodes.map(node => (
          <div key={`${node.id}-${adminMode}`}>
            <Circle
              key={`${node.id}-circle-${adminMode}`}
              center={[node.latitude, node.longitude]}
              radius={node.monitoring_radius_meters}
              interactive={adminMode === 'inspect'}
              pathOptions={{
                color: '#06b6d4',
                fillColor: '#06b6d4',
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
            <Marker 
              key={`${node.id}-marker-${adminMode}`}
              position={[node.latitude, node.longitude]}
              icon={customIcon}
              interactive={adminMode === 'inspect'}
            >
              <Popup className="text-gray-900 font-sans">
                <div className="p-2 min-w-[160px]">
                  <strong className="block text-sm font-semibold text-gray-900 mb-1">{node.name || `Node ${node.id.substring(0, 4)}`}</strong>
                  <div className="text-[11px] text-gray-500 space-y-0.5 mb-3 font-mono leading-relaxed border-t border-gray-100 pt-1 mt-1">
                    <div>ID: {node.id.substring(0, 8)}...</div>
                    <div>Lat: {node.latitude.toFixed(5)}</div>
                    <div>Lng: {node.longitude.toFixed(5)}</div>
                    <div>Radius: {node.monitoring_radius_meters}m</div>
                  </div>
                  <button
                    onClick={() => handleDeleteNode(node.id)}
                    className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Node
                  </button>
                </div>
              </Popup>
            </Marker>
          </div>
        ))}
        
        {/* Render a temporary marker where the user clicked */}
        {showModal && latStr && lngStr && !isNaN(parseFloat(latStr)) && !isNaN(isNaN(parseFloat(lngStr)) ? NaN : parseFloat(lngStr)) && (
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

        {/* Render existing database forest zones dynamically */}
        {forestZones.map(zone => (
          <GeoJSON
            key={`${zone.id}-${adminMode}`}
            data={zone.boundary_geom}
            interactive={adminMode === 'inspect'}
            style={{
              color: '#22c55e',
              fillColor: '#22c55e',
              fillOpacity: 0.08,
              weight: 2
            }}
          >
            <Tooltip sticky direction="top">
              <div className="text-gray-900 font-sans p-1">
                <strong className="block text-xs font-bold text-emerald-800">{zone.zone_name || 'Protected Forest Zone'}</strong>
                <span className="text-[10px] text-gray-500 font-medium block mt-0.5">Area Covered: {formatArea(calculatePolygonArea(zone.boundary_geom))}</span>
              </div>
            </Tooltip>
            <Popup className="text-gray-900 font-sans">
              <div className="p-2 min-w-[160px]">
                <strong className="block text-sm font-semibold text-gray-900 mb-1">{zone.zone_name || 'Protected Forest Zone'}</strong>
                <span className="text-[11px] text-gray-500 font-mono block mb-3 border-t border-gray-100 pt-1 mt-1">ID: {zone.id.substring(0, 8)}...</span>
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Zone
                </button>
              </div>
            </Popup>
          </GeoJSON>
        ))}

        {/* FeatureGroup and EditControl for drawing zones */}
        {adminMode === 'area' && (
          <FeatureGroup>
            <EditControl
              position="topright"
              onCreated={handleDrawCreated}
              draw={{
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1573f',
                    message: '<strong>Error:</strong> Boundary cannot intersect!'
                  },
                  shapeOptions: {
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.08
                  }
                },
                rectangle: {
                  shapeOptions: {
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.08
                  }
                }
              }}
            />
          </FeatureGroup>
        )}
      </MapContainer>

      {/* Floating Save Forest Boundary button */}
      {drawnGeometry && adminMode === 'area' && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-auto">
          <button
            onClick={handleSaveBoundary}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-105 border border-emerald-400/30 backdrop-blur-md cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 animate-pulse">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            Save Forest Boundary to Database
          </button>
        </div>
      )}

      {/* Admin Control Panel Toolbar */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto">
        <div className="backdrop-blur-xl bg-gray-900/90 border border-gray-700/50 shadow-2xl rounded-2xl p-4 w-72 flex flex-col gap-3 transition-all duration-300">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h2 className="text-white font-bold uppercase tracking-wider text-xs">Admin Control Panel</h2>
          </div>
          
          <div className="flex flex-col gap-2">
            {/* Inspect / Delete Mode */}
            <button
              onClick={() => handleModeChange('inspect')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                adminMode === 'inspect'
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold'
                  : 'bg-gray-800/20 border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
              }`}
            >
              <MousePointer className={`w-4 h-4 ${adminMode === 'inspect' ? 'text-emerald-400' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="text-xs tracking-wider uppercase">Inspect & Manage</div>
                <div className="text-[10px] text-gray-500 leading-snug mt-0.5 font-normal">Click on nodes or zones to view details and delete.</div>
              </div>
            </button>

            {/* Deploy Node Mode */}
            <button
              onClick={() => handleModeChange('node')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                adminMode === 'node'
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold'
                  : 'bg-gray-800/20 border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
              }`}
            >
              <PlusCircle className={`w-4 h-4 ${adminMode === 'node' ? 'text-emerald-400' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="text-xs tracking-wider uppercase">Deploy Node</div>
                <div className="text-[10px] text-gray-500 leading-snug mt-0.5 font-normal">Click on the map to define coordinates and deploy a node.</div>
              </div>
            </button>

            {/* Mark Forest Zone Mode */}
            <button
              onClick={() => handleModeChange('area')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                adminMode === 'area'
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold'
                  : 'bg-gray-800/20 border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
              }`}
            >
              <PenTool className={`w-4 h-4 ${adminMode === 'area' ? 'text-emerald-400' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="text-xs tracking-wider uppercase">Mark Forest Area</div>
                <div className="text-[10px] text-gray-500 leading-snug mt-0.5 font-normal">Draw custom spatial polygon boundaries on the map.</div>
              </div>
            </button>
          </div>
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
