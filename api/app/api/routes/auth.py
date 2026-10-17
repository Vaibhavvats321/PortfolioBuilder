"""Authentication routes: register, login, logout, and current user.

Handlers stay thin: they validate input through schemas, delegate to services,
and translate domain errors into safe HTTP responses. No password hashes or
tokens are ever returned in a response body.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import clear_session_cookie, get_current_user, require_csrf, set_session_cookies
from app.db.session import get_db
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth import EmailAlreadyRegisteredError, authenticate_user, register_user
from app.services.sessions import create_session, revoke_session

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CREDENTIALS = "Invalid email or password."


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    """Create a new account and start an authenticated session."""
    try:
        user = register_user(
            db,
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None

    _, raw_token, raw_csrf_token = create_session(db, user)
    set_session_cookies(response, raw_token=raw_token, raw_csrf_token=raw_csrf_token)
    return user


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    """Authenticate with email and password and start a session."""
    user = authenticate_user(db, email=payload.email, password=payload.password)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS,
        )

    _, raw_token, raw_csrf_token = create_session(db, user)
    set_session_cookies(response, raw_token=raw_token, raw_csrf_token=raw_csrf_token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session: AuthSession = Depends(require_csrf),
) -> Response:
    """Invalidate the current server-side session and clear its cookies.

    CSRF validation is required so a cross-site request cannot force a logout.
    The response always clears the cookies even though the session is revoked.
    """
    revoke_session(db, session)
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user, or 401 when unauthenticated."""
    return current_user
