"""Declarative base for all SQLAlchemy ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for ORM models.

    Importing models registers their tables on ``Base.metadata`` so that
    Alembic autogeneration can detect schema changes.
    """
