# pyrefly: ignore [missing-import]
import os
from uuid import UUID, uuid4
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Form, File, UploadFile, Response
from app.core.security import get_current_user
from app.core.logging import logger
from app.db.supabase import supabase
from app.services.websocket import manager
from app.api.schemas import (
    TelemetryPayload,
    AlertWorkflowUpdate,
    AlertActionPayload,
    NodePayload,
    NodeUpdatePayload,
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
async def process_alert_action(alert_id: UUID, payload: AlertActionPayload, current_user: dict = Depends(get_current_user)):
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
            "alert_id": str(alert_id),
            "action_taken": payload.action_type,
            "performed_by_username": current_user.get("full_name") or current_user.get("sub"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": payload.notes if payload.notes else f"Alert action processed: {payload.action_type}"
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
            "alert_id": str(alert_id) if alert_id else None,
            "action_taken": "Auto-Logged",
            "performed_by_username": f"node_{payload.node_id}",
            "notes": f"Acoustic anomaly classified: {payload.threat_type} detected"
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

@router.put("/api/nodes/{node_id}")
async def update_node_coordinates(node_id: UUID, payload: NodeUpdatePayload):
    """
    Update a monitoring node's latitude and longitude coordinates.
    """
    try:
        res = supabase.table("nodes").update({
            "latitude": payload.latitude,
            "longitude": payload.longitude
        }).eq("id", str(node_id)).execute()
        
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=404, detail="Node not found")
    except Exception as e:
        logger.error(f"Failed to update node coordinates {node_id}: {e}")
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

@router.get("/api/search")
async def get_search_combined():
    """
    Fetch all nodes and forest_zones to construct a combined searchable indexing payload.
    """
    try:
        # Fetch nodes
        nodes_res = supabase.table("nodes").select("id, name, latitude, longitude, monitoring_radius_meters").execute()
        # Fetch forest zones
        zones_res = supabase.table("forest_zones").select("id, zone_name, boundary_geom").execute()
        
        combined = []
        # Add nodes
        for node in (nodes_res.data or []):
            combined.append({
                "type": "node",
                "id": node["id"],
                "name": node["name"] or f"Node {node['id'][:8]}",
                "coordinates": [node["latitude"], node["longitude"]],
                "details": {
                    "monitoring_radius_meters": node["monitoring_radius_meters"]
                }
            })
            
        # Add forest zones
        for zone in (zones_res.data or []):
            center = None
            geom = zone.get("boundary_geom")
            if geom and geom.get("type") == "Polygon" and geom.get("coordinates"):
                try:
                    ring = geom["coordinates"][0]
                    sum_lng = sum(pt[0] for pt in ring)
                    sum_lat = sum(pt[1] for pt in ring)
                    count = len(ring)
                    if count > 0:
                        center = [sum_lat / count, sum_lng / count]
                except Exception:
                    pass
            
            combined.append({
                "type": "zone",
                "id": zone["id"],
                "name": zone["zone_name"] or "Protected Forest Area",
                "coordinates": center,
                "details": {
                    "boundary_geom": geom
                }
            })
            
        return combined
    except Exception as e:
        logger.error(f"Search index fetch failure: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.get("/api/audit-logs")
async def get_audit_logs():
    """
    Fetch all audit action logs from the database.
    """
    try:
        res = supabase.table("audit_logs").select("*").order("timestamp", desc=True).limit(100).execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to fetch audit logs: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.get("/api/logs")
async def get_logs(current_user: dict = Depends(get_current_user)):
    """
    Fetch all alerts joined with nodes and audit logs.
    If an alert has no corresponding audit log, return action_taken: 'Action Pending'
    and performed_by_username: null.
    The response is sorted by timestamp descending.
    """
    try:
        # Query alerts table, join with nodes and audit_logs
        res = supabase.table("alerts").select("*, nodes(name, latitude, longitude), audit_logs(*)").execute()
        
        flat_logs = []
        for alert in (res.data or []):
            alert_id = alert.get("id")
            threat_type = alert.get("threat_type")
            confidence_score = alert.get("confidence_score")
            node_id = alert.get("node_id")
            
            # Nodes relation
            node = alert.get("nodes") or {}
            node_name = node.get("name")
            latitude = node.get("latitude")
            longitude = node.get("longitude")
            
            # Audit logs relation
            audit_logs = alert.get("audit_logs") or []
            
            if audit_logs:
                # Find the latest audit log based on timestamp string comparison
                latest_log = sorted(audit_logs, key=lambda x: x.get("timestamp") or "", reverse=True)[0]
                log_id = latest_log.get("id") or alert_id
                action_taken = latest_log.get("action_taken")
                performed_by_username = latest_log.get("performed_by_username")
                timestamp = latest_log.get("timestamp") or alert.get("created_at")
                notes = latest_log.get("notes")
            else:
                log_id = alert_id
                action_taken = "Action Pending"
                performed_by_username = None
                timestamp = alert.get("created_at")
                notes = None
                
            log_entry = {
                "id": log_id,
                "alert_id": alert_id,
                "action_taken": action_taken,
                "performed_by_username": performed_by_username,
                "timestamp": timestamp,
                "notes": notes,
                "threat_type": threat_type,
                "confidence_score": confidence_score,
                "node_id": node_id,
                "node_name": node_name,
                "latitude": latitude,
                "longitude": longitude
            }
            flat_logs.append(log_entry)
            
        # Sort logs by timestamp descending
        flat_logs.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        return flat_logs
    except Exception as e:
        logger.error(f"Failed to fetch activity logs: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")


@router.get("/api/cases")
async def get_cases(response: Response, current_user: dict = Depends(get_current_user)):
    """
    Fetch all alerts where workflow_status is NOT 'Pending Review' or 'Action Pending'.
    Includes node_name, threat_type, and initiated_by.
    """
    try:
        response.headers["Cache-Control"] = "public, max-age=30"
        res = supabase.table("alerts").select("*, nodes(name)")\
            .neq("workflow_status", "Pending Review")\
            .neq("workflow_status", "Action Pending")\
            .order("created_at", desc=True)\
            .execute()
            
        cases = []
        for alert in (res.data or []):
            alert_id = alert.get("id")
            
            # Query audit_logs table for this alert_id to find the FIRST action taken by a human
            audit_res = supabase.table("audit_logs")\
                .select("performed_by_username")\
                .eq("alert_id", alert_id)\
                .not_.is_("performed_by_username", "null")\
                .not_.like("performed_by_username", "node_%")\
                .order("timestamp", desc=False)\
                .limit(1)\
                .execute()
                
            if not audit_res.data or len(audit_res.data) == 0:
                # Exclude cases with only automated initiation
                continue
                
            initiated_by = audit_res.data[0].get("performed_by_username")
            
            node_name = alert.get("nodes", {}).get("name") if alert.get("nodes") else None
            cases.append({
                "id": alert.get("id"),
                "node_id": alert.get("node_id"),
                "threat_type": alert.get("threat_type"),
                "confidence_score": alert.get("confidence_score"),
                "workflow_status": alert.get("workflow_status"),
                "created_at": alert.get("created_at"),
                "node_name": node_name,
                "initiated_by": initiated_by
            })
        return cases
    except Exception as e:
        logger.error(f"Failed to fetch cases: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")


@router.get("/api/cases/{alert_id}/updates")
async def get_case_updates(alert_id: UUID, current_user: dict = Depends(get_current_user)):
    """
    Fetch all case updates for a specific alert, ordered by created_at ascending.
    """
    try:
        # First verify alert exists
        alert_res = supabase.table("alerts").select("id").eq("id", str(alert_id)).execute()
        if not alert_res.data:
            raise HTTPException(status_code=404, detail="Alert not found")

        res = supabase.table("case_updates").select("*").eq("alert_id", str(alert_id)).order("created_at", desc=False).execute()
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch case updates for alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")


@router.post("/api/cases/{alert_id}/updates")
async def create_case_update(
    alert_id: UUID,
    report_text: str = Form(...),
    close_case: bool = Form(False),
    image: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Post a case update with optional image upload and optional case closing.
    """
    try:
        # First verify alert exists
        alert_res = supabase.table("alerts").select("id").eq("id", str(alert_id)).execute()
        if not alert_res.data:
            raise HTTPException(status_code=404, detail="Alert not found")

        image_path = None
        if image and image.filename:
            # Generate UUID filename
            ext = os.path.splitext(image.filename)[1]
            unique_filename = f"{uuid4()}{ext}"
            file_path = os.path.join("uploads", unique_filename)
            
            # Save the file locally
            with open(file_path, "wb") as f:
                content = await image.read()
                f.write(content)
            
            image_path = f"/uploads/{unique_filename}"

        # Insert case update
        update_data = {
            "alert_id": str(alert_id),
            "officer_username": current_user.get("full_name") or current_user.get("sub"),
            "report_text": report_text,
            "image_path": image_path,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = supabase.table("case_updates").insert(update_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save case update")
        
        inserted_update = res.data[0]

        if close_case:
            # Update workflow status of the alert
            alert_update_res = supabase.table("alerts").update({"workflow_status": "Closed - Resolved"}).eq("id", str(alert_id)).execute()
            if alert_update_res.data:
                # Broadcast the status update via WebSockets
                update_event = {
                    "type": "status_update",
                    "alert_id": str(alert_id),
                    "workflow_status": "Closed - Resolved"
                }
                await manager.broadcast(update_event)

        return inserted_update
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create case update for alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")




