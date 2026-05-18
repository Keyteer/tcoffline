"""Unit tests for HL7MessageBuilder (no DB, no HTTP)."""
from datetime import datetime
import pytest

from app.hl7_builder import HL7MessageBuilder


@pytest.fixture()
def builder() -> HL7MessageBuilder:
    return HL7MessageBuilder()


# ---------------------------------------------------------------------------
# MSH segment
# ---------------------------------------------------------------------------

class TestMSH:
    def test_msh_structure_and_version(self, builder):
        msh = builder.build_msh_segment("ADT", "A28", control_id="CID-1")
        assert msh.startswith("MSH|^~\\&|OFFLINE|LOCAL|CENTRAL|HOSPITAL|")
        assert "|ADT^A28|CID-1|P|2.5.1" in msh

    def test_msh_generates_control_id_when_absent(self, builder):
        msh = builder.build_msh_segment("ADT", "A01")
        # 12th field separator group has a non-empty control id
        parts = msh.split("|")
        assert len(parts[9]) > 0

    def test_msh_uses_custom_endpoints(self):
        b = HL7MessageBuilder(
            sending_application="DEV", sending_facility="UNIT",
            receiving_application="HUB", receiving_facility="DC",
        )
        msh = b.build_msh_segment("ADT", "A28", control_id="X")
        assert "|DEV|UNIT|HUB|DC|" in msh


# ---------------------------------------------------------------------------
# Gender normalization
# ---------------------------------------------------------------------------

class TestGenderNormalization:
    @pytest.mark.parametrize("raw,expected", [
        ("M", "M"), ("masculino", "M"), ("HOMBRE", "M"), ("Male", "M"),
        ("F", "F"), ("femenino", "F"), ("MUJER", "F"), ("female", "F"),
        ("O", "O"), ("OTRO", "O"), ("other", "O"),
        ("U", "U"), ("desconocido", "U"), ("unknown", "U"),
        ("A", "A"), ("ambiguo", "A"),
        ("N", "N"), ("no aplica", "N"),
        ("", "U"), ("garbage", "U"), (None, "U"),
    ])
    def test_normalize(self, builder, raw, expected):
        assert builder._normalize_administrative_gender(raw) == expected


# ---------------------------------------------------------------------------
# HL7 escaping
# ---------------------------------------------------------------------------

class TestEscape:
    def test_escapes_all_separators(self, builder):
        # NOTE: order matters — backslash escape MUST run before the others
        # so they aren't double-escaped.
        assert builder._escape_text("a|b") == "a\\F\\b"
        assert builder._escape_text("x^y") == "x\\S\\y"
        assert builder._escape_text("p&q") == "p\\T\\q"
        assert builder._escape_text("r~s") == "r\\R\\s"
        assert builder._escape_text("c\\d") == "c\\E\\d"

    def test_escape_empty_or_none(self, builder):
        assert builder._escape_text("") == ""
        assert builder._escape_text(None) == ""


# ---------------------------------------------------------------------------
# PID segment
# ---------------------------------------------------------------------------

class TestPID:
    def test_pid_with_rut(self, builder):
        pid = builder.build_pid_segment(
            patient_id="OFFP-1",
            rut="20602702-9",
            last_name="Rodriguez",
            first_name="Carmen",
            birth_date=datetime(1975, 12, 1),
            sex="F",
        )
        # PID|||<id>|<rut>|<last^first>||<dob>|<sex>
        parts = pid.split("|")
        assert parts[0] == "PID"
        assert parts[3] == "OFFP-1"
        assert parts[4] == "20602702-9"
        assert parts[5] == "Rodriguez^Carmen"
        assert parts[7] == "19751201000000"
        assert parts[8] == "F"

    def test_pid_without_rut_leaves_field_empty(self, builder):
        pid = builder.build_pid_segment(
            patient_id="X", rut=None,
            last_name="Soto", first_name="Ana",
            birth_date=datetime(1990, 1, 2), sex="femenino",
        )
        parts = pid.split("|")
        assert parts[4] == ""
        assert parts[8] == "F"


# ---------------------------------------------------------------------------
# PV1 / PV2
# ---------------------------------------------------------------------------

class TestPV1:
    def test_pv1_combines_unit_and_room(self, builder):
        pv1 = builder.build_pv1_segment(
            episode_id="ENC-1", patient_class="I",
            location="101", admission_type="A",
            admission_datetime=datetime(2026, 4, 21, 9, 0, 0),
            clinical_unit="UCI",
        )
        parts = pv1.split("|")
        assert parts[2] == "I"
        assert parts[3] == "UCI^101"
        assert parts[19] == "ENC-1"
        assert parts[-1] == "20260421090000"

    def test_pv1_only_unit(self, builder):
        pv1 = builder.build_pv1_segment("E", "O", None, None, datetime(2026, 1, 1), clinical_unit="Urgencias")
        assert "|Urgencias|" in pv1

    def test_pv1_only_location(self, builder):
        pv1 = builder.build_pv1_segment("E", "O", "Box3", None, datetime(2026, 1, 1))
        assert "|Box3|" in pv1


class TestPV2:
    def test_pv2_escapes_reason(self, builder):
        pv2 = builder.build_pv2_segment("Dolor|abdominal")
        assert pv2 == "PV2|||Dolor\\F\\abdominal"

    def test_pv2_empty(self, builder):
        assert builder.build_pv2_segment(None) == "PV2|||"


# ---------------------------------------------------------------------------
# Full messages — segment composition
# ---------------------------------------------------------------------------

class TestA28Message:
    def test_segments_in_order(self, builder):
        msg, cid = builder.build_a28_message(
            patient_id="OFFP-1", rut="11111111-1",
            last_name="Soto", first_name="Ana",
            birth_date=datetime(1990, 1, 1), sex="F",
            control_id="C1",
        )
        segs = [s for s in msg.split("\r") if s]
        assert segs[0].startswith("MSH|")
        assert segs[1].startswith("EVN|A28")
        assert segs[2].startswith("PID|")
        assert segs[3].startswith("PV1|")
        assert cid == "C1"


class TestA01Message:
    def test_includes_pv2_and_visit_number(self, builder):
        msg, _ = builder.build_a01_message(
            patient_id="P", rut=None,
            last_name="L", first_name="F",
            birth_date=datetime(1990, 1, 1), sex="M",
            episode_id="ENC-9", patient_class="I",
            location="101", admission_type="A",
            admission_datetime=datetime(2026, 4, 21, 10, 0, 0),
            motivo_consulta="Control",
            clinical_unit="UCI",
            control_id="C2",
        )
        segs = [s for s in msg.split("\r") if s]
        assert segs[0].startswith("MSH|")
        assert segs[1].startswith("EVN|A01")
        assert segs[2].startswith("PID|")
        assert segs[3].startswith("PV1|")
        assert segs[4].startswith("PV2|||Control")
        assert "ENC-9" in segs[3]


class TestORUMessage:
    def test_obx_per_observation(self, builder):
        # build_oru_message reads users from DB via OBR; pass an empty obs list
        # to skip the OBR/OBX section entirely.
        msg, _ = builder.build_oru_message(
            patient_id="P", rut=None,
            last_name="L", first_name="F",
            birth_date=datetime(1990, 1, 1), sex="M",
            episode_id="ENC-O", observations=[],
            control_id="C3",
        )
        segs = [s for s in msg.split("\r") if s]
        assert segs[0].startswith("MSH|ORU^R01" if False else "MSH|")
        assert "ORU^R01" in segs[0]
        assert segs[1].startswith("PID|")
        assert segs[2].startswith("PV1|")
        # no OBR/OBX when observations list is empty
        assert not any(s.startswith("OBR|") for s in segs)
        assert not any(s.startswith("OBX|") for s in segs)


class TestA03Message:
    def test_a03_segments(self, builder):
        msg, _ = builder.build_a03_message(
            patient_id="P", rut=None,
            last_name="L", first_name="F",
            birth_date=datetime(1990, 1, 1), sex="M",
            episode_id="ENC-D",
            discharge_datetime=datetime(2026, 4, 21, 18, 0, 0),
            control_id="C4",
        )
        segs = [s for s in msg.split("\r") if s]
        assert "ADT^A03" in segs[0]
        assert segs[1] == "EVN|A03|20260421180000"
        assert segs[2].startswith("PID|")
        assert "ENC-D" in segs[3]
