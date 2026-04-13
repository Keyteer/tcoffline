"""Tests for /auth endpoints."""
from tests.conftest import auth_headers, DEFAULT_PASSWORD


class TestLogin:
    def test_login_success(self, client, admin_user):
        resp = client.post("/auth/login", json={
            "username": admin_user.username,
            "password": DEFAULT_PASSWORD,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password(self, client, admin_user):
        resp = client.post("/auth/login", json={
            "username": admin_user.username,
            "password": "wrong",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/auth/login", json={
            "username": "ghost",
            "password": "nope",
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, inactive_user):
        resp = client.post("/auth/login", json={
            "username": inactive_user.username,
            "password": DEFAULT_PASSWORD,
        })
        assert resp.status_code == 403


class TestRefresh:
    def test_refresh_success(self, client, admin_user):
        login = client.post("/auth/login", json={
            "username": admin_user.username,
            "password": DEFAULT_PASSWORD,
        })
        refresh_token = login.json()["refresh_token"]

        resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    def test_refresh_invalid_token(self, client):
        resp = client.post("/auth/refresh", json={"refresh_token": "garbage"})
        assert resp.status_code == 401

    def test_refresh_with_access_token_fails(self, client, admin_user):
        login = client.post("/auth/login", json={
            "username": admin_user.username,
            "password": DEFAULT_PASSWORD,
        })
        access_token = login.json()["access_token"]
        resp = client.post("/auth/refresh", json={"refresh_token": access_token})
        assert resp.status_code == 401


class TestMe:
    def test_get_me(self, client, admin_user, admin_headers):
        resp = client.get("/auth/me", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == admin_user.username
        assert body["is_admin"] is True

    def test_get_me_unauthorized(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_update_me_nombre(self, client, user_headers):
        resp = client.put("/auth/me", json={"nombre": "New Name"}, headers=user_headers)
        assert resp.status_code == 200
        assert resp.json()["nombre"] == "New Name"

    def test_update_me_password(self, client, regular_user, user_headers):
        resp = client.put("/auth/me", json={"password": "newpass456"}, headers=user_headers)
        assert resp.status_code == 200

        # Old password should no longer work
        resp2 = client.post("/auth/login", json={
            "username": regular_user.username,
            "password": "newpass456",
        })
        assert resp2.status_code == 200


class TestUserManagement:
    def test_create_user_as_admin(self, client, admin_headers):
        resp = client.post("/auth/users", json={
            "username": "newdoc",
            "password": "doc12345",
            "nombre": "Dr. Test",
            "is_admin": False,
        }, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["username"] == "newdoc"

    def test_create_user_as_regular_forbidden(self, client, user_headers):
        resp = client.post("/auth/users", json={
            "username": "hacker",
            "password": "nope",
        }, headers=user_headers)
        assert resp.status_code == 403

    def test_create_duplicate_user(self, client, admin_user, admin_headers):
        resp = client.post("/auth/users", json={
            "username": admin_user.username,
            "password": "anything",
        }, headers=admin_headers)
        assert resp.status_code == 400

    def test_list_users_as_admin(self, client, admin_user, admin_headers):
        resp = client.get("/auth/users", headers=admin_headers)
        assert resp.status_code == 200
        usernames = [u["username"] for u in resp.json()]
        assert admin_user.username in usernames

    def test_list_users_as_regular_forbidden(self, client, user_headers):
        resp = client.get("/auth/users", headers=user_headers)
        assert resp.status_code == 403
