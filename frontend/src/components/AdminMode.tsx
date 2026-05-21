import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, GeoJSON, LayersControl, Tooltip, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { calculatePolygonArea, formatArea } from '../utils/geoUtils';
import MapSearch from './MapSearch';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { 
  Trash2, 
  Users, 
  UserPlus, 
  Lock, 
  User as UserIcon, 
  Phone, 
  MapPin, 
  Loader2,
  X,
  RefreshCw
} from 'lucide-react';

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

// Custom DrawControl using native Leaflet.Draw to avoid CJS default export bugs in Vite
function DrawControl({ onCreated }: { onCreated: (e: any) => void }) {
  const map = useMap();
  const onCreatedRef = useRef(onCreated);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  useEffect(() => {
    const activeL = (window as any).L || L;
    if (!activeL.Control || !(activeL.Control as any).Draw) {
      console.error("Leaflet.Draw is not registered on global L or window.L!");
      return;
    }

    const drawnItems = new activeL.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new (activeL.Control as any).Draw({
      position: 'topleft',
      edit: {
        featureGroup: drawnItems,
        remove: true
      },
      draw: {
        circle: false,
        marker: false,
        circlemarker: false,
        polyline: false,
        polygon: {
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
      }
    });

    map.addControl(drawControl);

    const handleCreated = (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      if (onCreatedRef.current) {
        onCreatedRef.current(e);
      }
    };

    map.on('draw:created', handleCreated);

    return () => {
      map.removeControl(drawControl);
      map.off('draw:created', handleCreated);
      map.removeLayer(drawnItems);
    };
  }, [map]);

  return null;
}

export default function AdminMode() {
  const [searchParams] = useSearchParams();
  const currentTool = searchParams.get('tool') || 'inspect';

  // Deriving active admin mode from search params tool
  const adminMode = (currentTool === 'node' || currentTool === 'area') ? currentTool : 'inspect';

  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState<L.LatLng | null>(null);
  
  // Form state for deploying node
  const [nodeId, setNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [radius, setRadius] = useState('500');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');

  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [forestZones, setForestZones] = useState<any[]>([]);

  // Accounts management states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create User Form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newRank, setNewRank] = useState('Forest Ranger');
  const [newAddress, setNewAddress] = useState('');
  const [newGovId, setNewGovId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');



  const handleDrawCreated = useCallback((e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon' || layerType === 'rectangle') {
      const geojson = layer.toGeoJSON();
      console.log("Extracted GeoJSON coordinates:", geojson.geometry.coordinates);
      setDrawnGeometry(geojson.geometry);
    }
  }, []);

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
        alert(`Failed to save forest zone: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error saving forest zone:", err);
      alert("Error saving forest zone.");
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Are you sure you want to delete this monitoring node?")) return;
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

  const handleNodeDragEnd = async (nodeId: string, lat: number, lng: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update node coordinates');
      }

      // Update local state coordinates
      setNodes(prev => prev.map(node => 
        node.id === nodeId ? { ...node, latitude: lat, longitude: lng } : node
      ));
    } catch (err: any) {
      console.error("Error dragging node:", err);
      alert('Error updating node location: ' + err.message);
      // Reset position from backend
      fetchNodes();
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
      .then(res => res.ok ? res.json() : [])
      .then(data => setNodes(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching nodes:", err);
        setNodes([]);
      });
  };

  const fetchForestZones = () => {
    fetch('http://localhost:8000/api/forest-zones')
      .then(res => res.ok ? res.json() : [])
      .then(data => setForestZones(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching forest zones:", err);
        setForestZones([]);
      });
  };

  const fetchAccounts = async () => {
    setAccLoading(true);
    setAccError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:8000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch accounts list');
      }
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setAccError(err.message || 'Error communicating with server');
    } finally {
      setAccLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchForestZones();
    setDrawnGeometry(null); // Clear unsaved drawing on tool change
    if (currentTool === 'accounts') {
      fetchAccounts();
    }
  }, [currentTool]);

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setClickedLatLng(latlng);
    setLatStr(latlng.lat.toFixed(5));
    setLngStr(latlng.lng.toFixed(5));
    setNodeId(uuidv4()); // Auto-generate a UUID for convenience
    setNodeName(`Node ${Math.floor(Math.random() * 1000)}`);
    setShowModal(true);
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickedLatLng || !nodeId.trim() || !radius) return;

    try {
      const response = await fetch('http://localhost:8000/api/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: nodeId.trim(),
          name: nodeName.trim() || `Node ${nodeId.substring(0,8)}`,
          latitude: parseFloat(latStr),
          longitude: parseFloat(lngStr),
          monitoring_radius_meters: parseInt(radius)
        })
      });

      if (response.ok) {
        alert("Node deployed successfully!");
        setShowModal(false);
        fetchNodes();
      } else {
        const err = await response.json();
        alert(`Failed to deploy node: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error deploying node:", err);
      alert("Error deploying node.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    
    if (!newUsername.trim() || !newPassword) {
      setCreateError('Username and Password are required.');
      return;
    }

    setCreateLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:8000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          contact_number: newContact.trim(),
          rank: newRank,
          address: newAddress.trim(),
          government_id: newGovId.trim()
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create official account');
      }

      // Reset form
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewContact('');
      setNewRank('Forest Ranger');
      setNewAddress('');
      setNewGovId('');
      setCreateError('');
      setShowCreateModal(false);
      alert("Official account created successfully!");
      fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || 'Error communicating with server');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    if (currentUser && currentUser.id === id) {
      alert("You cannot delete your own profile.");
      return;
    }

    if (!confirm(`Are you sure you want to delete the official account: '${username}'?`)) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:8000/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to delete account');
      }
      alert("Account deleted successfully.");
      fetchAccounts();
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  // Custom Icon for standard node
  const customIcon = L.divIcon({
    className: 'custom-node-icon',
    html: `<div style="background-color: #06b6d4; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Render User Accounts Management Page
  if (currentTool === 'accounts') {
    return (
      <div className="w-full h-full bg-gray-950 p-8 overflow-y-auto text-slate-100 relative font-sans">
        {/* Gradients */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto space-y-6">
          
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/15 rounded-2xl border border-emerald-500/30">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Official Accounts</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manage credentials and authorization access for DeepGreen officials</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchAccounts}
                className="p-2.5 bg-gray-800 hover:bg-gray-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl cursor-pointer transition-colors"
                title="Refresh List"
              >
                <RefreshCw className={`w-4 h-4 ${accLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-lg border border-emerald-500/30 cursor-pointer active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Register Official
              </button>
            </div>
          </div>

          {/* Error Message */}
          {accError && (
            <div className="p-4 bg-red-950/50 border border-red-500/30 text-red-300 text-xs font-semibold rounded-2xl">
              {accError}
            </div>
          )}

          {/* Accounts List Table Card */}
          <div className="bg-gray-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
            {accLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Syncing official registry...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-xs font-semibold uppercase tracking-wider">
                No official accounts registered in database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="px-6 py-4">Full Name</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Rank / Position</th>
                      <th className="px-6 py-4">Gov ID</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {accounts.map(acc => (
                      <tr 
                        key={acc.id}
                        className="hover:bg-slate-900/30 transition-colors text-xs text-slate-300"
                      >
                        <td className="px-6 py-4 font-bold text-white whitespace-nowrap">{acc.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 font-mono text-slate-400">{acc.username}</td>
                        <td className="px-6 py-4 font-medium">{acc.rank || 'N/A'}</td>
                        <td className="px-6 py-4 font-mono text-slate-400 font-semibold">{acc.government_id || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{acc.contact_number || 'N/A'}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteUser(acc.id, acc.username)}
                            className="p-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg cursor-pointer transition-all"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create Official Account Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-lg bg-gray-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
              
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError('');
                }}
                className="absolute top-4 right-4 p-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-750 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/80">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-white">Register Official</h3>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Create a secure government official profile</p>
                </div>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-650">
                        <UserIcon className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="ranger.smith"
                        required
                        className="w-full pl-8 pr-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-650">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-8 pr-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Officer John Smith"
                      className="w-full px-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs"
                    />
                  </div>

                  {/* Gov ID */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Government ID</label>
                    <input
                      type="text"
                      value={newGovId}
                      onChange={(e) => setNewGovId(e.target.value)}
                      placeholder="GOV-505-RANGER"
                      className="w-full px-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Rank Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rank Position</label>
                    <select
                      value={newRank}
                      onChange={(e) => setNewRank(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs cursor-pointer"
                    >
                      <option value="Forest Ranger">Forest Ranger</option>
                      <option value="Senior Ranger">Senior Ranger</option>
                      <option value="Deputy Warden">Deputy Warden</option>
                      <option value="Chief Warden">Chief Warden (Admin Access)</option>
                    </select>
                  </div>

                  {/* Contact */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Number</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-650">
                        <Phone className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={newContact}
                        onChange={(e) => setNewContact(e.target.value)}
                        placeholder="+91-XXXXXXXXXX"
                        className="w-full pl-8 pr-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Station Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-start pt-2 pl-3 pointer-events-none text-slate-650">
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    <textarea
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Beat Office, Pune Sector 5, Maharashtra"
                      rows={2}
                      className="w-full pl-8 pr-3 py-2 bg-gray-950 border border-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-100 rounded-xl text-xs resize-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateError('');
                    }}
                    className="flex-1 py-2 px-4 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-lg border border-emerald-500/30"
                  >
                    {createLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <span>Complete Registration</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Map Administration Pane
  return (
    <div className={`relative w-full h-full bg-gray-950 text-slate-100 ${adminMode === 'node' ? 'mode-node-active' : ''}`}>
      {/* Map Container */}
      <MapContainer 
        key={`${adminMode}`} // Forces map reload when mode changes to update EditControl settings
        center={[18.4647, 73.8744]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className={`z-0 ${adminMode === 'node' ? 'mode-node-active' : ''}`}
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

        <MapSearch />

        {/* Map Click Listener for Deploy Node */}
        <MapClickHandler onMapClick={handleMapClick} active={adminMode === 'node'} />

        {/* Render dynamic forest zones from database */}
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
            <Popup className="text-gray-900 font-sans">
              <strong className="block text-xs font-bold text-emerald-800">{zone.zone_name || 'Protected Forest Zone'}</strong>
              <span className="text-[10px] text-gray-500 font-medium block mt-1">Area: {formatArea(calculatePolygonArea(zone.boundary_geom))}</span>
              {adminMode === 'inspect' && (
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="mt-2 text-[10px] font-bold text-red-650 hover:text-red-500 border border-red-500/20 hover:border-red-500/40 rounded px-1.5 py-0.5 w-full cursor-pointer flex items-center justify-center gap-1 bg-red-50/50"
                >
                  <Trash2 className="w-3 h-3" /> Delete Area
                </button>
              )}
            </Popup>
            <Tooltip sticky direction="top">
              <div className="text-gray-900 font-sans p-1">
                <strong className="block text-xs font-bold text-emerald-800">{zone.zone_name || 'Protected Forest Zone'}</strong>
                <span className="text-[10px] text-gray-500 font-medium block mt-0.5">Area Covered: {formatArea(calculatePolygonArea(zone.boundary_geom))}</span>
              </div>
            </Tooltip>
          </GeoJSON>
        ))}

        {/* Render existing nodes */}
        {nodes.map(node => (
          <div key={`${node.id}-${adminMode}`}>
            <Circle 
              center={[node.latitude, node.longitude]}
              radius={node.monitoring_radius_meters}
              pathOptions={{
                color: '#06b6d4',
                fillColor: '#06b6d4',
                fillOpacity: 0.15,
                weight: 2,
                interactive: adminMode === 'inspect'
              }}
            />
            <Marker 
              position={[node.latitude, node.longitude]}
              icon={customIcon}
              interactive={adminMode === 'inspect'}
              draggable={adminMode === 'inspect'}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  handleNodeDragEnd(node.id, position.lat, position.lng);
                }
              }}
            >
              <Popup className="text-gray-900 font-sans">
                <strong className="block text-xs font-bold text-cyan-800">{node.name || `Node ${node.id.substring(0,8)}`}</strong>
                <span className="text-[10px] text-gray-500 block">Radius: {node.monitoring_radius_meters}m</span>
                <span className="text-[10px] text-gray-500 block">Coords: {node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}</span>
                {adminMode === 'inspect' && (
                  <button
                    onClick={() => handleDeleteNode(node.id)}
                    className="mt-2 text-[10px] font-bold text-red-650 hover:text-red-500 border border-red-500/20 hover:border-red-500/40 rounded px-1.5 py-0.5 w-full cursor-pointer flex items-center justify-center gap-1 bg-red-50/50"
                  >
                    <Trash2 className="w-3 h-3" /> Remove Node
                  </button>
                )}
              </Popup>
            </Marker>
          </div>
        ))}

        {/* Native Leaflet Draw Controls */}
        {adminMode === 'area' && (
          <DrawControl onCreated={handleDrawCreated} />
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




      {/* Modal Form */}
      {showModal && clickedLatLng && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-gray-900 border border-slate-700 shadow-2xl rounded-2xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-xl font-bold text-white mb-4">Deploy New Node</h3>
            
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-450 uppercase tracking-wider mb-1">Latitude</label>
                  <input 
                    type="text" 
                    value={latStr}
                    onChange={(e) => setLatStr(e.target.value)}
                    className="w-full bg-gray-850 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-450 uppercase tracking-wider mb-1">Longitude</label>
                  <input 
                    type="text" 
                    value={lngStr}
                    onChange={(e) => setLngStr(e.target.value)}
                    className="w-full bg-gray-850 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-450 uppercase tracking-wider mb-1">Node ID (UUID)</label>
                <input 
                  type="text" 
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full bg-gray-850 border border-gray-700 rounded p-2 text-white font-mono text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-450 uppercase tracking-wider mb-1">Node Identifier Name</label>
                <input 
                  type="text" 
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full bg-gray-850 border border-gray-700 rounded p-2 text-white text-sm focus:outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-450 uppercase tracking-wider mb-1">Monitoring Radius (Meters)</label>
                <input 
                  type="number" 
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full bg-gray-850 border border-gray-700 rounded p-2 text-white text-sm focus:outline-none"
                  min="10"
                  max="5000"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer border border-slate-700"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-lg border border-emerald-500/30"
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
