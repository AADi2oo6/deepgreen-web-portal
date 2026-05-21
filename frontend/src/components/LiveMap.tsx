import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, GeoJSON, LayersControl, Tooltip, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import MapSearch from './MapSearch';
import L from 'leaflet';
import forestBoundary from '../assets/forestBoundary.json';
import { calculatePolygonArea, formatArea } from '../utils/geoUtils';


interface NodeData {
  id: string;
  latitude: number;
  longitude: number;
  monitoring_radius_meters: number;
}

interface AlertData {
  id?: string;
  node_id: string;
  threat_type: string;
  confidence_score: number;
}

function MapLocator({ nodes }: { nodes: NodeData[] }) {
  const map = useMap();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const locateNodeId = searchParams.get('locate');
    if (locateNodeId && nodes.length > 0) {
      const targetNode = nodes.find(n => n.id === locateNodeId);
      if (targetNode) {
        map.flyTo([targetNode.latitude, targetNode.longitude], 15, {
          duration: 1.5
        });
      }
    }
  }, [searchParams, nodes, map]);

  return null;
}

export default function LiveMap() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [activeThreatNodes, setActiveThreatNodes] = useState<Set<string>>(new Set());
  const [activeAlert, setActiveAlert] = useState<AlertData | null>(null);
  const [forestZones, setForestZones] = useState<any[]>([]);

  useEffect(() => {
    // Fetch initial nodes
    fetch('http://localhost:8000/api/nodes')
      .then(res => res.ok ? res.json() : [])
      .then(data => setNodes(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching nodes:", err);
        setNodes([]);
      });

    // Fetch dynamic forest zones from database
    fetch('http://localhost:8000/api/forest-zones')
      .then(res => res.ok ? res.json() : [])
      .then(data => setForestZones(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error("Error fetching forest zones:", err);
        setForestZones([]);
      });

    // Connect WebSocket for real-time telemetry alerts
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.threat_type && payload.node_id) {
          // Add new alert to the UI, keep only the latest 5
          setAlerts(prev => [payload, ...prev].slice(0, 5));
          setActiveAlert(payload);
          
          // Add node to active threats list
          setActiveThreatNodes(prev => {
            const newSet = new Set(prev);
            newSet.add(payload.node_id);
            return newSet;
          });
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
    html: `<div style="background-color: #06b6d4; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const handleAction = async (actionType: string, targetAlert?: AlertData) => {
    const alertToProcess = targetAlert || activeAlert;
    if (!alertToProcess || !alertToProcess.id) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`http://localhost:8000/api/alerts/${alertToProcess.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action_type: actionType
        })
      });
      
      // Clear alert and map pin
      setActiveThreatNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertToProcess.node_id);
        return newSet;
      });
      
      if (activeAlert && activeAlert.id === alertToProcess.id) {
        setActiveAlert(null);
      }
    } catch (err) {
      console.error("Failed to perform action", err);
    }
  };

  // Custom icon indicating an active threat (red + pulsing/blinking)
  const alertIcon = L.divIcon({
    className: 'custom-alert-icon',
    html: `<div style="background-color: #ef4444; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; animation: blink-node 0.8s infinite alternate, pulse-shadow 1.5s infinite;"></div>`,
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
        <MapLocator nodes={nodes} />
        
        <GeoJSON
          data={forestBoundary as any}
          style={{
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.08,
            weight: 2
          }}
        >
          <Tooltip sticky direction="top">
            <div className="text-gray-900 font-sans p-1">
              <strong className="block text-xs font-bold text-emerald-800">Pune Forest Protected Area</strong>
              <span className="text-[10px] text-gray-500 font-medium block mt-0.5">Area Covered: {formatArea(calculatePolygonArea(forestBoundary))}</span>
            </div>
          </Tooltip>
        </GeoJSON>

        {/* Render dynamic forest zones from database */}
        {forestZones.map(zone => (
          <GeoJSON
            key={zone.id}
            data={zone.boundary_geom}
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
          </GeoJSON>
        ))}
        
        {nodes.map(node => {
          const isThreatActive = activeThreatNodes.has(node.id);
          
          return (
            <div key={node.id}>
              <Circle
                center={[node.latitude, node.longitude]}
                radius={node.monitoring_radius_meters}
                pathOptions={{
                  color: isThreatActive ? '#ef4444' : '#06b6d4',
                  fillColor: isThreatActive ? '#ef4444' : '#06b6d4',
                  fillOpacity: isThreatActive ? 0.4 : 0.15,
                  weight: 2,
                  className: isThreatActive ? 'blink-circle' : ''
                }}
              />
              <Marker 
                position={[node.latitude, node.longitude]}
                icon={isThreatActive ? alertIcon : customIcon}
              >
                <Popup className="text-gray-900 font-sans">
                  <div className="space-y-2">
                    <div>
                      <strong>Node ID:</strong> {node.id.substring(0, 8)}...<br/>
                      <strong>Radius:</strong> {node.monitoring_radius_meters}m
                    </div>
                    {isThreatActive && (() => {
                      const alertForNode = activeAlert?.node_id === node.id 
                        ? activeAlert 
                        : alerts.find(a => a.node_id === node.id);
                      if (!alertForNode) return null;
                      return (
                        <div className="pt-2 border-t border-gray-250 space-y-1.5">
                          <div className="text-xs font-bold text-red-650 uppercase">Active Threat: {alertForNode.threat_type}</div>
                          <div className="text-[10px] text-gray-500">Confidence: {(alertForNode.confidence_score * 100).toFixed(1)}%</div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleAction('Escalated', alertForNode)}
                              className="px-2 py-1 bg-red-650 hover:bg-red-550 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Escalate
                            </button>
                            <button
                              onClick={() => handleAction('False Alarm', alertForNode)}
                              className="px-2 py-1 bg-gray-650 hover:bg-gray-550 text-gray-200 border border-gray-500 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              False Alarm
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>

      {/* Action Panel Overlay */}
      {activeAlert && (
        <div className="absolute top-4 right-4 z-[1001] w-96 backdrop-blur-xl bg-gray-900/95 border border-slate-700 shadow-2xl rounded-2xl p-6 text-white transform transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-4 w-4 relative">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </div>
            <h2 className="text-xl font-bold tracking-wider text-red-400 uppercase">Action Required</h2>
          </div>
          
          <div className="space-y-4 mb-8 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider">Threat Type</p>
              <p className="text-2xl font-semibold text-white">{activeAlert.threat_type}</p>
            </div>
            <div className="flex justify-between items-center border-t border-gray-700 pt-4">
              <div>
                <p className="text-sm text-gray-400 uppercase tracking-wider">Node ID</p>
                <p className="text-sm font-mono text-gray-200">{activeAlert.node_id.substring(0, 12)}...</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 uppercase tracking-wider">Confidence</p>
                <p className="text-lg font-mono text-emerald-400">{(activeAlert.confidence_score * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => handleAction('Escalated')}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-lg shadow-red-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Escalate to Field Visit
            </button>
            <button 
              onClick={() => handleAction('False Alarm')}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Mark False Alarm
            </button>
          </div>
        </div>
      )}

      {/* Real-time Notifications Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3 w-80 pointer-events-none mt-0">
        {!activeAlert && alerts.map((alert, idx) => (
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
        @keyframes pulse-shadow {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes blink-node {
          0% { transform: scale(1); opacity: 1; background-color: #ef4444; }
          100% { transform: scale(1.3); opacity: 0.7; background-color: #fca5a5; }
        }
        .blink-circle {
          animation: blink-circle-anim 0.8s infinite alternate;
        }
        @keyframes blink-circle-anim {
          0% { stroke-opacity: 1; fill-opacity: 0.4; stroke: #ef4444; }
          100% { stroke-opacity: 0.3; fill-opacity: 0.1; stroke: #f87171; }
        }
      `}</style>
    </div>
  );
}
