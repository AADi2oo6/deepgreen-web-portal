from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from uuid import UUID
import logging

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

# Pydantic schema for validation of telemetry payloads
class TelemetryPayload(BaseModel):
    node_id: UUID = Field(..., description="Unique identifier of the monitoring station/node")
    threat_type: str = Field(..., min_length=1, description="E.g., Chainsaw, Vehicle, Gunshot, Fire")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Model confidence score between 0.0 and 1.0")

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
    Ingest real-time acoustic/vision telemetry from monitoring nodes.
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
    
    return {
        "status": "success",
        "message": "Telemetry payload successfully logged to console.",
        "received_data": {
            "node_id": str(payload.node_id),
            "threat_type": payload.threat_type,
            "confidence_score": payload.confidence_score
        }
    }
