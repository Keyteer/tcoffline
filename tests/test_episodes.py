"""Tests for /episodes endpoints."""
from tests.conftest import make_episode_payload
from app import models


class TestCreateEpisode:
    def test_create_episode(self, client, user_headers, db):
        payload = make_episode_payload()
        resp = client.post("/episodes", json=payload, headers=user_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["num_episodio"] == "EP001"
        assert body["mrn"] == "MRN001"
        assert body["synced_flag"] is False

        # Verify outbox event was created
        outbox = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.correlation_id == "EP001"
        ).first()
        assert outbox is not None
        assert outbox.event_type == "episode_created"
        assert outbox.status == "pending"

    def test_create_duplicate_episode(self, client, user_headers):
        payload = make_episode_payload(num_episodio="DUP001")
        resp1 = client.post("/episodes", json=payload, headers=user_headers)
        assert resp1.status_code == 201

        resp2 = client.post("/episodes", json=payload, headers=user_headers)
        assert resp2.status_code == 400

    def test_create_episode_formats_patient_name(self, client, user_headers):
        payload = make_episode_payload(
            num_episodio="EP-NAME",
            paciente="García López Juan",
        )
        resp = client.post("/episodes", json=payload, headers=user_headers)
        assert resp.status_code == 201
        # "García López Juan" → "García López, Juan"
        assert resp.json()["paciente"] == "García López, Juan"

    def test_create_episode_unauthorized(self, client):
        payload = make_episode_payload()
        resp = client.post("/episodes", json=payload)
        assert resp.status_code == 401


class TestListEpisodes:
    def _seed_episodes(self, client, headers):
        for i in range(3):
            client.post("/episodes", json=make_episode_payload(
                num_episodio=f"LIST-{i}",
                mrn=f"MRN-{i}",
                tipo="Ambulatorio" if i < 2 else "Hospitalizado",
            ), headers=headers)

    def test_list_episodes(self, client, user_headers):
        self._seed_episodes(client, user_headers)
        resp = client.get("/episodes", headers=user_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_list_episodes_filter_by_type(self, client, user_headers):
        self._seed_episodes(client, user_headers)
        resp = client.get("/episodes?type=Hospitalizado", headers=user_headers)
        assert resp.status_code == 200
        for ep in resp.json():
            assert ep["tipo"] == "Hospitalizado"

    def test_list_episodes_pagination(self, client, user_headers):
        self._seed_episodes(client, user_headers)
        resp = client.get("/episodes?skip=0&limit=1", headers=user_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetEpisode:
    def test_get_episode_by_id(self, client, user_headers):
        create = client.post("/episodes", json=make_episode_payload(
            num_episodio="GET-1",
        ), headers=user_headers)
        ep_id = create.json()["id"]

        resp = client.get(f"/episodes/{ep_id}", headers=user_headers)
        assert resp.status_code == 200
        assert resp.json()["num_episodio"] == "GET-1"

    def test_get_episode_not_found(self, client, user_headers):
        resp = client.get("/episodes/99999", headers=user_headers)
        assert resp.status_code == 404


class TestUpdateEpisode:
    def test_update_episode(self, client, user_headers, db):
        create = client.post("/episodes", json=make_episode_payload(
            num_episodio="UPD-1",
        ), headers=user_headers)
        ep_id = create.json()["id"]

        resp = client.put(f"/episodes/{ep_id}", json={
            "estado": "Alta",
            "ubicacion": "Piso 3",
        }, headers=user_headers)
        assert resp.status_code == 200
        assert resp.json()["estado"] == "Alta"
        assert resp.json()["ubicacion"] == "Piso 3"

        # Verify outbox event for update
        outbox = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.event_type == "episode_updated",
            models.OutboxEvent.correlation_id == "UPD-1",
        ).first()
        assert outbox is not None

    def test_update_episode_not_found(self, client, user_headers):
        resp = client.put("/episodes/99999", json={"estado": "X"}, headers=user_headers)
        assert resp.status_code == 404


class TestDeleteEpisode:
    def test_delete_episode(self, client, user_headers):
        create = client.post("/episodes", json=make_episode_payload(
            num_episodio="DEL-1",
        ), headers=user_headers)
        ep_id = create.json()["id"]

        resp = client.delete(f"/episodes/{ep_id}", headers=user_headers)
        assert resp.status_code == 204

        get_resp = client.get(f"/episodes/{ep_id}", headers=user_headers)
        assert get_resp.status_code == 404

    def test_delete_episode_not_found(self, client, user_headers):
        resp = client.delete("/episodes/99999", headers=user_headers)
        assert resp.status_code == 404


class TestUniqueValues:
    def _seed(self, client, headers):
        for i, (tipo, ubi) in enumerate([
            ("Ambulatorio", "Urgencias"),
            ("Ambulatorio", "Piso 2"),
            ("Hospitalizado", "Piso 3"),
        ]):
            client.post("/episodes", json=make_episode_payload(
                num_episodio=f"UNIQ-{i}",
                mrn=f"MRN-UNIQ-{i}",
                tipo=tipo,
                ubicacion=ubi,
            ), headers=headers)

    def test_unique_types(self, client, user_headers):
        self._seed(client, user_headers)
        resp = client.get("/episodes/types/unique", headers=user_headers)
        assert resp.status_code == 200
        types = resp.json()
        assert "Ambulatorio" in types
        assert "Hospitalizado" in types

    def test_unique_locations(self, client, user_headers):
        self._seed(client, user_headers)
        resp = client.get("/episodes/locations/unique", headers=user_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_unique_locations_filtered_by_type(self, client, user_headers):
        self._seed(client, user_headers)
        resp = client.get("/episodes/locations/unique?tipo=Hospitalizado", headers=user_headers)
        assert resp.status_code == 200
        locations = resp.json()
        assert "Piso 3" in locations
        assert "Urgencias" not in locations
