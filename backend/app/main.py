import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from uuid import UUID
from typing import List
import logging
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("deepgreen-backend")

app = FastAPI(
    title="DeepGreen Web Portal Backend",
    description="Backend API service for DeepGreen ecological threat monitoring",
    version="1.0.0"
)

# Enable CORS for local and web development access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development ease. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Supabase Database Configuration ---
# Use environment variables if available, otherwise fallback to known service role keys
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://nouapgibquswkmdyiden.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdWFwZ2licXVzd2ttZHlpZGVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTAyOTUwMSwiZXhwIjoyMDk0NjA1NTAxfQ.kpIr9mYGjK-ChSxPnkRnlgfWy7gsfybvUUQmV7zi5r0")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Broadcast JSON telemetry events to all active WebSocket connections in real-time.
        """
        logger.info(f"Broadcasting telemetry to {len(self.active_connections)} active clients...")
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client connection: {e}")

# Instantiate the shared connection manager
manager = ConnectionManager()

# --- Pydantic Telemetry Schema ---
class TelemetryPayload(BaseModel):
    node_id: UUID = Field(..., description="Unique identifier of the monitoring station/node")
    threat_type: str = Field(..., min_length=1, description="E.g., Chainsaw, Vehicle, Gunshot, Fire")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Model confidence score between 0.0 and 1.0")

class AlertWorkflowUpdate(BaseModel):
    workflow_status: str = Field(..., min_length=1, description="E.g., investigating, resolved")

# --- Routes and Endpoints ---
@app.get("/api/nodes")
async def get_nodes():
    """
    Fetch all monitoring nodes from the Supabase database.
    """
    try:
        res = supabase.table("nodes").select("*").execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch nodes: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@app.get("/api/alerts")
async def get_alerts():
    """
    Fetch recent telemetry alerts from the Supabase database.
    """
    try:
        # Order by created_at descending, limit to 50
        res = supabase.table("alerts").select("*").order("created_at", desc=True).limit(50).execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@app.patch("/api/alerts/{alert_id}")
async def update_alert_status(alert_id: UUID, payload: AlertWorkflowUpdate):
    """
    Update workflow status of an alert and broadcast to clients.
    """
    try:
        res = supabase.table("alerts").update({"workflow_status": payload.workflow_status}).eq("id", str(alert_id)).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        updated_alert = res.data[0]
        
        # Broadcast the status update
        update_event = {
            "type": "status_update",
            "alert_id": str(alert_id),
            "workflow_status": payload.workflow_status
        }
        await manager.broadcast(update_event)
        
        return updated_alert
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update alert status: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@app.get("/")
async def health_check():
    """
    Health check endpoint to verify backend service state.
    """
    logger.info("Health check endpoint queried.")
    return {
        "status": "healthy",
        "service": "DeepGreen Backend API",
        "version": "1.0.0"
    }

@app.post("/api/telemetry")
async def receive_telemetry(payload: TelemetryPayload):
    """
    Ingest real-time acoustic/vision telemetry from monitoring nodes and broadcast via WebSocket.
    """
    # Print the payload details cleanly to the console
    print("\n" + "="*50)
    print("INCOMING TELEMETRY ALERT RECEIVED")
    print(f" - Node ID:         {payload.node_id}")
    print(f" - Threat Type:     {payload.threat_type}")
    print(f" - Confidence:      {payload.confidence_score:.2%}")
    print("="*50 + "\n")
    
    # Also log it using the standard FastAPI logger
    logger.info(f"Ingested telemetry data: node_id={payload.node_id} threat='{payload.threat_type}' conf={payload.confidence_score}")
    
    # Insert telemetry into Supabase database
    try:
        alert_data = {
            "node_id": str(payload.node_id),
            "threat_type": payload.threat_type,
            "confidence_score": payload.confidence_score,
            "workflow_status": "triggered"
        }
        alert_res = supabase.table("alerts").insert(alert_data).execute()
        alert_id = alert_res.data[0]["id"]
        
        # Insert audit log
        audit_data = {
            "action": f"Acoustic anomaly classified: {payload.threat_type} detected",
            "performed_by": f"node_{payload.node_id}",
            "details": alert_data
        }
        supabase.table("audit_logs").insert(audit_data).execute()
    except Exception as e:
        logger.error(f"Database insert failed: {e}")
        alert_id = None  # Proceed with broadcast anyway
    
    # Structure data payload for client transmission
    alert_event = {
        "type": "new_alert",
        "id": alert_id,
        "node_id": str(payload.node_id),
        "threat_type": payload.threat_type,
        "confidence_score": payload.confidence_score,
        "workflow_status": "triggered"
    }
    
    # Broadcast telemetry alert in real-time to all connected frontend clients
    await manager.broadcast(alert_event)
    
    return {
        "status": "success",
        "message": "Telemetry payload successfully logged to console and broadcasted.",
        "received_data": alert_event
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time telemetry stream WebSocket endpoint.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; discard/ignore any incoming text sent from clients
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket client communication error: {e}")
        manager.disconnect(websocket)
