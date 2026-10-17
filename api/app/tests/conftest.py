"""Shared pytest fixtures.

Tests run against an isolated PostgreSQL database. The test database URL is
taken from ``TEST_DATABASE_URL`` when set, otherwise derived from
``DATABASE_URL`` by appending ``_test`` to the database name. The fixtures
refuse to run if the resolved test database is the configured development
database, so destructive cleanup can never touch development data.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app


def _resolve_test_database_url() -> str:
    explicit = os.getenv("TEST_DATABASE_URL")
    if explicit:
        return explicit

    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("Tests need a database: set TEST_DATABASE_URL or DATABASE_URL.")

    dev_url = make_url(settings.database_url)
    test_url = dev_url.set(database=f"{dev_url.database}_test")
    return test_url.render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """Return the validated, isolated test database URL."""
    dev_url = make_url(get_settings().database_url) if get_settings().database_url else None
    test_url = make_url(_resolve_test_database_url())

    if dev_url is not None and test_url.database == dev_url.database:
        raise RuntimeError("Refusing to run tests against the development database.")
    if not test_url.database or not test_url.database.endswith("_test"):
        raise RuntimeError("Test database name must end with '_test'.")
    return test_url.render_as_string(hide_password=False)


def _ensure_database_exists(test_url: str) -> None:
    """Create the test database if it does not already exist."""
    url = make_url(test_url)
    admin_url = url.set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as connection:
            exists = connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": url.database},
            )
            if not exists:
                connection.exec_driver_sql(f'CREATE DATABASE "{url.database}"')
    finally:
        admin_engine.dispose()


@pytest.fixture(scope="session")
def test_engine(test_database_url: str) -> Iterator[Engine]:
    """Provide an engine bound to the test database with a fresh schema."""
    _ensure_database_exists(test_database_url)
    engine = create_engine(test_database_url, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Iterator[Session]:
    """Yield a session wrapped in a transaction that is rolled back per test.

    ``create_savepoint`` lets services call ``commit()`` while the outer
    transaction still guarantees isolation and a full rollback afterwards.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    factory = sessionmaker(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = factory()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """Return a TestClient whose database dependency uses the test session."""

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def csrf_cookie_name() -> str:
    return get_settings().csrf_cookie_name


@pytest.fixture
def session_cookie_name() -> str:
    return get_settings().session_cookie_name


@pytest.fixture
def client_factory(db_session: Session) -> Iterator[Callable[[], TestClient]]:
    """Provide a factory for independent TestClients sharing the test session.

    Each client has its own cookie jar, so multiple clients can represent
    different authenticated users within a single test.
    """

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    clients: list[TestClient] = []

    def factory() -> TestClient:
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    try:
        yield factory
    finally:
        for client in clients:
            client.__exit__(None, None, None)
        app.dependency_overrides.clear()
