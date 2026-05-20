# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from uuid import UUID
from app.core.logging import logger
from app.db.supabase import supabase
from app.services.websocket import manager
from app.api.schemas import (
    TelemetryPayload,
    AlertWorkflowUpdate,
    AlertActionPayload,
    NodePayload,
    ForestZoneCreate,
    ForestZoneResponse
)

router = APIRouter()

@router.get("/api/nodes")
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

@router.post("/api/nodes")
async def create_node(payload: NodePayload):
    """
    Create a new monitoring node.
    """
    try:
        node_data = {
            "id": str(payload.id),
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "monitoring_radius_meters": payload.monitoring_radius_meters
        }
        res = supabase.table("nodes").insert(node_data).execute()
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=500, detail="Failed to create node")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create node: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.get("/api/alerts")
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

@router.patch("/api/alerts/{alert_id}")
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

@router.post("/api/alerts/{alert_id}/action")
async def process_alert_action(alert_id: UUID, payload: AlertActionPayload):
    """
    Process an action on an alert (e.g., Escalate, Mark as False Alarm) and log the audit trail.
    """
    try:
        workflow_status = payload.action_type.lower()
        res = supabase.table("alerts").update({"workflow_status": workflow_status}).eq("id", str(alert_id)).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        updated_alert = res.data[0]
        
        audit_data = {
            "action": f"Alert {payload.action_type}",
            "performed_by": payload.user_name,
            "details": {"alert_id": str(alert_id), "action": payload.action_type}
        }
        supabase.table("audit_logs").insert(audit_data).execute()
        
        update_event = {
            "type": "status_update",
            "alert_id": str(alert_id),
            "workflow_status": workflow_status
        }
        await manager.broadcast(update_event)
        
        return {"status": "success", "alert": updated_alert}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process alert action: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.post("/api/telemetry")
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

@router.websocket("/ws")
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

@router.get("/api/forest-zones")
async def get_forest_zones():
    """
    Fetch all protected forest zones from the Supabase database.
    """
    try:
        res = supabase.table("forest_zones").select("*").execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch forest zones: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.post("/api/forest-zones")
async def create_forest_zone(payload: ForestZoneCreate):
    """
    Create a new protected forest zone.
    """
    try:
        zone_data = {
            "zone_name": payload.zone_name,
            "boundary_geom": payload.boundary_geom
        }
        res = supabase.table("forest_zones").insert(zone_data).execute()
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=500, detail="Failed to create forest zone")
    except Exception as e:
        logger.error(f"Failed to create forest zone: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.delete("/api/nodes/{node_id}")
async def delete_node(node_id: UUID):
    """
    Delete a monitoring node and its associated alerts from the database.
    """
    try:
        # First delete associated alerts to prevent foreign key constraint violations
        supabase.table("alerts").delete().eq("node_id", str(node_id)).execute()
        
        # Now delete the node itself
        res = supabase.table("nodes").delete().eq("id", str(node_id)).execute()
        if res.data:
            return {"status": "success", "message": f"Node {node_id} deleted successfully."}
        raise HTTPException(status_code=404, detail="Node not found")
    except Exception as e:
        logger.error(f"Failed to delete node {node_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.delete("/api/forest-zones/{zone_id}")
async def delete_forest_zone(zone_id: UUID):
    """
    Delete a protected forest zone from the database.
    """
    try:
        res = supabase.table("forest_zones").delete().eq("id", str(zone_id)).execute()
        if res.data:
            return {"status": "success", "message": f"Forest zone {zone_id} deleted successfully."}
        raise HTTPException(status_code=404, detail="Forest zone not found")
    except Exception as e:
        logger.error(f"Failed to delete forest zone {zone_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")


