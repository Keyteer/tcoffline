"""
Build HL7 messages as JSON payload files for use with tc.http.
Uses app/hl7_builder.py directly (requires project deps installed).

Usage:
  python requests/build_hl7.py            # build all types
  python requests/build_hl7.py a28
  python requests/build_hl7.py a01
  python requests/build_hl7.py a03
  python requests/build_hl7.py oru

Output files (written next to this script, gitignored):
  requests/hl7_a28.json
  requests/hl7_a01.json
  requests/hl7_a03.json
  requests/hl7_oru.json

Edit the variables below and re-run to change patient/episode data.
For A01/A03/ORU after a real A28, set PATIENT_ID to the central pid
and EPISODE_ID to the central enctid returned by the previous response.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add project root so app.hl7_builder can be imported directly
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.hl7_builder import HL7MessageBuilder  # noqa: E402

OUT = Path(__file__).parent

# ── Patient ───────────────────────────────────────────────────────────────────
PATIENT_ID    = "OFFP100001"   # local MRN; central assigns real PID on A28
RUT           = "62858962-3"   # set to None to omit PID.4
LAST_NAME     = "Rodriguez"
FIRST_NAME    = "Carmen"
BIRTH_DATE    = datetime(1975, 12, 1)
SEX           = "F"            # M / F / O / U

# ── Episode ───────────────────────────────────────────────────────────────────
EPISODE_ID    = "OFFE100001"   # local episode; central assigns enctid on A01
PATIENT_CLASS = "O"            # O=Outpatient  E=Emergency  I=Inpatient
LOCATION      = "Consulta Telemedicina"
CLINICAL_UNIT = "Box 3"
ADMISSION_DT  = datetime(2026, 5, 8, 12, 0, 0)
MOTIVO        = "Dolor abdominal de 3 dias de evolucion"

# ── Note (ORU) ────────────────────────────────────────────────────────────────
NOTE_TEXT = (
    "Paciente refiere dolor abdominal difuso de 3 dias de evolucion. "
    "Afebril. Abdomen blando, doloroso a la palpacion en FID. "
    "Se solicita hemograma y ecografia abdominal. "
    "Se indica analgesia y control en 24 h."
)
PROFESIONAL = "doctest"   # sent in OBR.32 → central reads as NOTNurseIdDR

# ─────────────────────────────────────────────────────────────────────────────


class _Builder(HL7MessageBuilder):
    """
    Thin subclass that overrides build_obr_segment to skip the DB lookup
    (used in the outbox processor at runtime) and use PROFESIONAL directly.
    """

    def build_obr_segment(
        self,
        set_id: int,
        test_code: str,
        test_name: str,
        observation_datetime: Optional[datetime] = None,
    ) -> str:
        obs_dt = (
            self._format_datetime(observation_datetime)
            if observation_datetime
            else self._generate_timestamp()
        )
        return (
            f"OBR|{set_id}||{test_code}^{test_name}^LOCAL|||"
            f"{obs_dt}|{obs_dt}|||||||||||||||||||||||||{PROFESIONAL}"
        )


builder = _Builder()


def _wrap(msg: str, msg_type: str) -> dict:
    return {
        "msg": msg,
        "msg_type": msg_type,
        "fecha_envio": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }

# ── Message builders ──────────────────────────────────────────────────────────


def a28() -> dict:
    msg, _ = builder.build_a28_message(
        patient_id=PATIENT_ID,
        rut=RUT,
        last_name=LAST_NAME,
        first_name=FIRST_NAME,
        birth_date=BIRTH_DATE,
        sex=SEX,
    )
    return _wrap(msg, "ADT^A28")


def a01() -> dict:
    msg, _ = builder.build_a01_message(
        patient_id=PATIENT_ID,
        rut=RUT,
        last_name=LAST_NAME,
        first_name=FIRST_NAME,
        birth_date=BIRTH_DATE,
        sex=SEX,
        episode_id=EPISODE_ID,
        patient_class=PATIENT_CLASS,
        location=LOCATION,
        admission_type=None,
        admission_datetime=ADMISSION_DT,
        motivo_consulta=MOTIVO,
        clinical_unit=CLINICAL_UNIT,
    )
    return _wrap(msg, "ADT^A01")


def a03() -> dict:
    msg, _ = builder.build_a03_message(
        patient_id=PATIENT_ID,
        rut=RUT,
        last_name=LAST_NAME,
        first_name=FIRST_NAME,
        birth_date=BIRTH_DATE,
        sex=SEX,
        episode_id=EPISODE_ID,
        discharge_datetime=datetime.utcnow(),
    )
    return _wrap(msg, "ADT^A03")


def oru() -> dict:
    now = datetime.utcnow()
    observations = [
        {
            "observation_id":   "CLINICALNOTE",
            "observation_text": "Clinical Note",
            "value_type":       "TX",
            "value":            NOTE_TEXT,
            "units":            "",
            "datetime":         now,
        }
    ]
    msg, _ = builder.build_oru_message(
        patient_id=PATIENT_ID,
        rut=RUT,
        last_name=LAST_NAME,
        first_name=FIRST_NAME,
        birth_date=BIRTH_DATE,
        sex=SEX,
        episode_id=EPISODE_ID,
        observations=observations,
        patient_class=PATIENT_CLASS,
        location=LOCATION,
        observation_datetime=now,
        motivo_consulta=MOTIVO,
        clinical_unit=CLINICAL_UNIT,
    )
    return _wrap(msg, "ORU^R01")


# ─────────────────────────────────────────────────────────────────────────────

BUILDERS = {
    "a28": ("hl7_a28.json", a28),
    "a01": ("hl7_a01.json", a01),
    "a03": ("hl7_a03.json", a03),
    "oru": ("hl7_oru.json", oru),
}

if __name__ == "__main__":
    targets = sys.argv[1:] or list(BUILDERS)
    for t in targets:
        if t not in BUILDERS:
            print(f"Unknown type '{t}'. Valid: {', '.join(BUILDERS)}")
            sys.exit(1)
        fname, fn = BUILDERS[t]
        path = OUT / fname
        path.write_text(json.dumps(fn(), indent=2, ensure_ascii=False))
        print(f"wrote {path.relative_to(Path(__file__).parents[1])}")
