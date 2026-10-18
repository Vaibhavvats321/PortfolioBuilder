"""Media asset tests.

Coverage: authenticated upload with CSRF, validation of file type/size, metadata
persistence, file serving, metadata updates, deletion, ownership isolation
between users, and per-portfolio scoping.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.tests.support import (
    create_portfolio,
    delete_media,
    fetch_media,
    list_media,
    media_file,
    png_bytes,
    register,
    unique_slug,
    update_media,
    upload_media,
)


def _portfolio_id(client: TestClient, name: str = "Site") -> str:
    response = create_portfolio(client, name=name, slug=unique_slug("site"))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_upload_requires_authentication() -> None:
    response = TestClient(app).post("/portfolios/00000000-0000-0000-0000-000000000000/media")
    assert response.status_code == 401


def test_upload_requires_csrf(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = client.post(
        f"/portfolios/{portfolio_id}/media",
        files={"file": ("image.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 403


def test_upload_creates_asset_with_metadata(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = upload_media(client, portfolio_id, alt_text="A portrait", caption="Headshot")

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["portfolio_id"] == portfolio_id
    assert data["original_filename"] == "image.png"
    assert data["mime_type"] == "image/png"
    assert data["alt_text"] == "A portrait"
    assert data["caption"] == "Headshot"
    assert data["size_bytes"] > 0


def test_upload_rejects_non_image(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = upload_media(
        client,
        portfolio_id,
        filename="notes.txt",
        content=b"not an image",
        content_type="text/plain",
    )

    assert response.status_code == 422


def test_upload_rejects_oversized_file(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = upload_media(client, portfolio_id, content=b"x" * (10 * 1024 * 1024 + 1))

    assert response.status_code == 422


def test_upload_rejects_content_mismatched_with_declared_type(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = upload_media(
        client,
        portfolio_id,
        filename="image.png",
        content=b"this is not actually a png",
        content_type="image/png",
    )

    assert response.status_code == 422


def test_upload_rejects_empty_file(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)

    response = upload_media(client, portfolio_id, content=b"")

    assert response.status_code == 422


def test_list_media_returns_uploaded_assets(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    first = upload_media(client, portfolio_id).json()["id"]
    second = upload_media(client, portfolio_id).json()["id"]

    response = list_media(client, portfolio_id)

    assert response.status_code == 200
    ids = [asset["id"] for asset in response.json()]
    assert set(ids) == {first, second}


def test_media_file_serves_stored_bytes(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    media_id = upload_media(client, portfolio_id).json()["id"]

    response = media_file(client, media_id)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.content == png_bytes()


def test_update_media_metadata(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    media_id = upload_media(client, portfolio_id).json()["id"]

    response = update_media(client, media_id, alt_text="Updated", caption="New caption")

    assert response.status_code == 200
    assert response.json()["alt_text"] == "Updated"
    assert fetch_media(client, media_id).json()["caption"] == "New caption"


def test_update_media_requires_csrf(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    media_id = upload_media(client, portfolio_id).json()["id"]

    response = client.patch(f"/media/{media_id}", json={"alt_text": "Nope"})

    assert response.status_code == 403


def test_delete_media_removes_asset(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    media_id = upload_media(client, portfolio_id).json()["id"]

    assert delete_media(client, media_id).status_code == 204
    assert fetch_media(client, media_id).status_code == 404
    assert media_file(client, media_id).status_code == 404


def test_delete_media_requires_csrf(client: TestClient) -> None:
    register(client)
    portfolio_id = _portfolio_id(client)
    media_id = upload_media(client, portfolio_id).json()["id"]

    response = client.delete(f"/media/{media_id}")

    assert response.status_code == 403


def test_media_operations_isolated_between_users(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a, display_name="A")
    register(client_b, display_name="B")

    portfolio_id = _portfolio_id(client_a)
    media_id = upload_media(client_a, portfolio_id).json()["id"]

    assert list_media(client_b, portfolio_id).status_code == 404
    assert upload_media(client_b, portfolio_id).status_code == 404
    assert fetch_media(client_b, media_id).status_code == 404
    assert media_file(client_b, media_id).status_code == 404
    assert update_media(client_b, media_id, alt_text="Hacked").status_code == 404
    assert delete_media(client_b, media_id).status_code == 404


def test_media_scoped_to_its_portfolio_for_same_user(client: TestClient) -> None:
    register(client)
    portfolio_a = _portfolio_id(client, name="A")
    portfolio_b = _portfolio_id(client, name="B")
    media_id = upload_media(client, portfolio_a).json()["id"]

    assert [asset["id"] for asset in list_media(client, portfolio_b).json()] == []
    assert fetch_media(client, media_id).status_code == 200
