import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';

interface NodeData {
  id: string;
  latitude: number;
  longitude: number;
  monitoring_radius_meters: number;
}

interface AlertData {
  node_id: string;
  threat_type: string;
  confidence_score: number;
}

export default function LiveMap() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [activeThreatNodes, setActiveThreatNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch initial nodes
    fetch('http://localhost:8000/api/nodes')
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error("Error fetching nodes:", err));

    // Connect WebSocket for real-time telemetry alerts
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.threat_type && payload.node_id) {
          // Add new alert to the UI, keep only the latest 5
          setAlerts(prev => [payload, ...prev].slice(0, 5));
          
          // Add node to active threats list
          setActiveThreatNodes(prev => {
            const newSet = new Set(prev);
            newSet.add(payload.node_id);
            return newSet;
          });

          // Remove the red highlight after 5 seconds
          setTimeout(() => {
            setActiveThreatNodes(prev => {
              const newSet = new Set(prev);
              newSet.delete(payload.node_id);
              return newSet;
            });
          }, 5000);
        }
      } catch (err) {
        console.error("Error parsing websocket message:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Custom icon for a normal monitoring node
  const customIcon = L.divIcon({
    className: 'custom-node-icon',
    html: `<div style="background-color: #10b981; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Custom icon indicating an active threat (red + pulsing)
  const alertIcon = L.divIcon({
    className: 'custom-alert-icon',
    html: `<div style="background-color: #ef4444; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.8); animation: pulse 1.5s infinite;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <div className="relative w-full h-screen bg-gray-950 text-slate-100">
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
        
        {nodes.map(node => {
          const isThreatActive = activeThreatNodes.has(node.id);
          
          return (
            <div key={node.id}>
              <Circle
                center={[node.latitude, node.longitude]}
                radius={node.monitoring_radius_meters}
                pathOptions={{
                  color: isThreatActive ? '#ef4444' : '#10b981',
                  fillColor: isThreatActive ? '#ef4444' : '#10b981',
                  fillOpacity: isThreatActive ? 0.4 : 0.15,
                  weight: 2
                }}
              />
              <Marker 
                position={[node.latitude, node.longitude]}
                icon={isThreatActive ? alertIcon : customIcon}
              >
                <Popup className="text-gray-900 font-sans">
                  <strong>Node ID:</strong> {node.id.substring(0, 8)}...<br/>
                  <strong>Radius:</strong> {node.monitoring_radius_meters}m
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>

      {/* Real-time Notifications Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3 w-80 pointer-events-none">
        {alerts.map((alert, idx) => (
          <div 
            key={`${alert.node_id}-${idx}`}
            className="pointer-events-auto backdrop-blur-xl bg-gray-900/80 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] rounded-xl p-4 text-white transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <h3 className="font-bold text-red-400 uppercase tracking-wider text-sm">Threat Detected</h3>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-lg font-semibold">{alert.threat_type}</p>
              <div className="flex justify-between items-end">
                <div className="text-sm text-gray-300">
                  <span className="text-gray-500">Node:</span> {alert.node_id.substring(0,8)}...
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <span className="font-mono text-emerald-400">
                    {(alert.confidence_score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
