import pytest
from conftest import sign_up
from fastapi.testclient import TestClient

from prelegal_backend.drafts import make_title

CSA = {
    "documentType": "csa",
    "values": {"provider.company": "Acme Inc", "customer.company": "Beta Corp"},
    "messages": [
        {"role": "assistant", "content": "Hi!"},
        {"role": "user", "content": "A CSA please"},
        {"role": "assistant", "content": "Done.", "updated": ["Provider company"]},
    ],
}


def create(client: TestClient, body: dict | None = None):
    return client.post("/api/documents", json=CSA if body is None else body)


def test_create_and_read_back(user_client: TestClient) -> None:
    res = create(user_client)
    assert res.status_code == 201
    doc = res.json()
    assert doc["title"] == "Cloud Service Agreement · Acme Inc & Beta Corp"
    assert doc["values"] == CSA["values"]
    assert doc["messages"] == CSA["messages"]
    assert user_client.get(f"/api/documents/{doc['id']}").json() == doc


def test_list_is_newest_first_without_contents(user_client: TestClient) -> None:
    first = create(user_client).json()
    second = create(user_client, {"documentType": None}).json()
    user_client.put(f"/api/documents/{first['id']}", json={**CSA, "values": {}})
    listed = user_client.get("/api/documents").json()
    assert [d["id"] for d in listed] == [first["id"], second["id"]]
    assert set(listed[0]) == {"id", "documentType", "title", "createdAt", "updatedAt"}
    assert listed[0]["title"] == "Cloud Service Agreement"
    assert listed[1]["title"] == "Untitled draft"


def test_update_replaces_contents(user_client: TestClient) -> None:
    doc = create(user_client).json()
    res = user_client.put(f"/api/documents/{doc['id']}", json={"documentType": "pilot", "values": {"pilotPeriod": "90 days"}})
    body = res.json()
    assert res.status_code == 200
    assert (body["documentType"], body["values"], body["messages"]) == ("pilot", {"pilotPeriod": "90 days"}, [])
    assert body["updatedAt"] >= doc["updatedAt"]


def test_delete(user_client: TestClient) -> None:
    doc = create(user_client).json()
    assert user_client.delete(f"/api/documents/{doc['id']}").status_code == 204
    assert user_client.get(f"/api/documents/{doc['id']}").status_code == 404
    assert user_client.delete(f"/api/documents/{doc['id']}").status_code == 404


def test_documents_are_private_to_their_owner(user_client: TestClient) -> None:
    doc = create(user_client).json()
    user_client.post("/api/auth/logout")
    sign_up(user_client, "bob@example.com")
    assert user_client.get("/api/documents").json() == []
    assert user_client.get(f"/api/documents/{doc['id']}").status_code == 404
    assert user_client.put(f"/api/documents/{doc['id']}", json=CSA).status_code == 404
    assert user_client.delete(f"/api/documents/{doc['id']}").status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "/api/documents"), ("post", "/api/documents"), ("get", "/api/documents/1"), ("delete", "/api/documents/1")],
)
def test_requires_sign_in(client: TestClient, method: str, path: str) -> None:
    kwargs = {"json": CSA} if method == "post" else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"documentType": "lease"},
        {"values": {"a": 1}},
        {"messages": [{"role": "system", "content": "x"}]},
        {"messages": [{"role": "user", "content": ""}]},
    ],
)
def test_invalid_documents_are_rejected(user_client: TestClient, body: dict) -> None:
    assert create(user_client, body).status_code == 422


def test_title_uses_the_named_parties() -> None:
    assert make_title("mutual-nda", {"party1.company": "Acme", "party2.company": " "}) == "Mutual Non-Disclosure Agreement · Acme"
    assert make_title(None, {}) == "Untitled draft"
