# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging import logger
from app.api.endpoints import router as api_router

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

# Include API Router
app.include_router(api_router)

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
