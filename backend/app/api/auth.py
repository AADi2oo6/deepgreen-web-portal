from fastapi import APIRouter, HTTPException, Request, status, Depends
from pydantic import BaseModel
from typing import Optional
from app.db.supabase import supabase
from app.core.logging import logger
from app.core.security import verify_password, hash_password, create_access_token, get_current_user, get_admin_user

router = APIRouter()

class LoginPayload(BaseModel):
    username: str
    password: str

class CreateUserPayload(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    contact_number: Optional[str] = None
    rank: Optional[str] = None
    address: Optional[str] = None
    government_id: Optional[str] = None

@router.post("/api/auth/login")
async def login(request: Request):
    """
    Authenticate an official and return a JWT access token alongside user details and role.
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
        
        role = "admin" if official.get("rank") == "Chief Warden" else "official"

        # Create token with role included
        token_data = {
            "sub": official["username"],
            "id": official["id"],
            "full_name": official.get("full_name"),
            "rank": official.get("rank"),
            "role": role
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
                "role": role,
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

@router.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get information about the currently logged-in user.
    """
    username = current_user.get("sub")
    try:
        res = supabase.table("officials").select("*").eq("username", username).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        official = res.data[0]
        role = "admin" if official.get("rank") == "Chief Warden" else "official"
        return {
            "id": official["id"],
            "username": official["username"],
            "full_name": official.get("full_name"),
            "rank": official.get("rank"),
            "role": role,
            "contact_number": official.get("contact_number"),
            "government_id": official.get("government_id"),
            "address": official.get("address")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching current user profile {username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user details"
        )

@router.get("/api/admin/users")
async def list_users(admin_user: dict = Depends(get_admin_user)):
    """
    Admin-only endpoint to list all official accounts.
    """
    try:
        res = supabase.table("officials").select("id, username, full_name, rank, contact_number, government_id, address").execute()
        return res.data
    except Exception as e:
        logger.error(f"Admin failed to list users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/api/admin/users", status_code=status.HTTP_201_CREATED)
async def create_user(payload: CreateUserPayload, admin_user: dict = Depends(get_admin_user)):
    """
    Admin-only endpoint to create a new official account.
    """
    try:
        # Check if username already exists
        exist_res = supabase.table("officials").select("id").eq("username", payload.username).execute()
        if exist_res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        hashed = hash_password(payload.password)
        user_data = {
            "username": payload.username,
            "password_hash": hashed,
            "full_name": payload.full_name,
            "contact_number": payload.contact_number,
            "rank": payload.rank,
            "address": payload.address,
            "government_id": payload.government_id
        }
        
        insert_res = supabase.table("officials").insert(user_data).execute()
        if not insert_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )
        
        created = insert_res.data[0]
        return {
            "id": created["id"],
            "username": created["username"],
            "full_name": created.get("full_name"),
            "rank": created.get("rank"),
            "contact_number": created.get("contact_number"),
            "government_id": created.get("government_id")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to create user {payload.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """
    Admin-only endpoint to delete an official account.
    """
    try:
        # Validate that user_id exists
        exist_res = supabase.table("officials").select("id", "username").eq("id", user_id).execute()
        if not exist_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        username_to_delete = exist_res.data[0]["username"]
        # Prevent admin from self-deleting
        if username_to_delete == admin_user.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot delete their own accounts"
            )

        delete_res = supabase.table("officials").delete().eq("id", user_id).execute()
        if not delete_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user account"
            )
            
        return {"status": "success", "message": f"User account '{username_to_delete}' has been deleted."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to delete user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
