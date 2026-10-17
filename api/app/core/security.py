"""Security primitives: password hashing, token generation, and CSRF helpers.

Only opaque, cryptographically random tokens are used. Raw secrets (passwords,
session tokens, CSRF tokens) are never logged and session/CSRF tokens are only
persisted as SHA-256 hashes.
"""

import hashlib
import hmac
import secrets

from pwdlib import PasswordHash

_password_hash = PasswordHash.recommended()

SESSION_TOKEN_BYTES = 32
CSRF_TOKEN_BYTES = 32


def hash_password(password: str) -> str:
    """Hash a plaintext password with the recommended (Argon2) algorithm."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return _password_hash.verify(password, password_hash)


def generate_token(nbytes: int = SESSION_TOKEN_BYTES) -> str:
    """Return a new cryptographically secure, URL-safe random token."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest used to persist a token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_match(candidate: str, expected: str) -> bool:
    """Constant-time comparison of two secrets of arbitrary length."""
    return hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))
