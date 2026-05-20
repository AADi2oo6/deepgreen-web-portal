from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from app.db.supabase import supabase
from app.core.logging import logger
from app.core.security import verify_password, create_access_token

router = APIRouter()

class LoginPayload(BaseModel):
    username: str
    password: str

@router.post("/api/auth/login")
async def login(request: Request):
    """
    Authenticate an official and return a JWT access token.
    Accepts either application/json or x-www-form-urlencoded / form-data.
    """
    content_type = request.headers.get("content-type", "")
    username = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload"
            )
    else:
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid form data payload"
            )

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )

    try:
        # Fetch the official from Supabase
        res = supabase.table("officials").select("*").eq("username", username).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )
        
        official = res.data[0]
        # Verify the password hash
        if not verify_password(password, official["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )
        
        # Create token
        token_data = {
            "sub": official["username"],
            "id": official["id"],
            "full_name": official.get("full_name"),
            "rank": official.get("rank")
        }
        access_token = create_access_token(data=token_data)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": official["id"],
                "username": official["username"],
                "full_name": official.get("full_name"),
                "rank": official.get("rank"),
                "contact_number": official.get("contact_number"),
                "government_id": official.get("government_id")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error for user {username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed due to server error"
        )
