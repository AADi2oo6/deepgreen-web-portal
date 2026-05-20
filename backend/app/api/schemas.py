from pydantic import BaseModel, Field
from uuid import UUID

class TelemetryPayload(BaseModel):
    alert_id: UUID = Field(..., description="Unique identifier for the specific threat alert")
    node_id: UUID = Field(..., description="Unique identifier of the monitoring station/node")
    threat_type: str = Field(..., min_length=1, description="E.g., Chainsaw, Vehicle, Gunshot, Fire")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Model confidence score between 0.0 and 1.0")

class AlertWorkflowUpdate(BaseModel):
    workflow_status: str = Field(..., min_length=1, description="E.g., investigating, resolved")

class AlertActionPayload(BaseModel):
    action_type: str = Field(..., min_length=1, description="E.g., Escalated, False Alarm")
    user_name: str = Field(..., min_length=1, description="E.g., Officer Smith")

class NodePayload(BaseModel):
    id: UUID
    name: str = Field(default="New Node", description="Name of the node")
    latitude: float
    longitude: float
    monitoring_radius_meters: float

from typing import Dict, Any

class ForestZoneCreate(BaseModel):
    zone_name: str = Field(..., min_length=1, description="Name of the protected forest zone")
    boundary_geom: Dict[str, Any] = Field(..., description="GeoJSON geometry object")

class ForestZoneResponse(BaseModel):
    id: UUID
    zone_name: str
    boundary_geom: Dict[str, Any]

