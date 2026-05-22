from datetime import datetime
from typing import Optional
import uuid


class HL7MessageBuilder:
    """
    Builder for HL7 v2.5 messages.
    Supports A28 (Add Patient), A01 (Admit Patient), ORU (Observation Result).
    OBR.24 (sending user) is passed explicitly from the session user — never read from DB.
    """

    def __init__(
        self,
        sending_application: str = "OFFLINE",
        sending_facility: str = "LAN",
        receiving_application: str = "CENTRAL",
        receiving_facility: str = "HOSPITAL"
    ):
        self.sending_application = sending_application
        self.sending_facility = sending_facility
        self.receiving_application = receiving_application
        self.receiving_facility = receiving_facility

    def _generate_timestamp(self) -> str:
        return datetime.utcnow().strftime("%Y%m%d%H%M%S")

    def _generate_control_id(self) -> str:
        return str(uuid.uuid4())[:20].replace("-", "").upper()

    def _format_name(self, last_name: str, first_name: str) -> str:
        return f"{last_name}^{first_name}"

    def _format_datetime(self, dt: datetime) -> str:
        return dt.strftime("%Y%m%d%H%M%S") if dt else ""

    def _escape_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace("\\", "\\E\\")
        text = text.replace("|", "\\F\\")
        text = text.replace("^", "\\S\\")
        text = text.replace("&", "\\T\\")
        text = text.replace("~", "\\R\\")
        return text

    def build_msh_segment(self, message_type: str, trigger_event: str, control_id: Optional[str] = None) -> str:
        if not control_id:
            control_id = self._generate_control_id()
        timestamp = self._generate_timestamp()
        return (
            f"MSH|^~\\&|{self.sending_application}|{self.sending_facility}|"
            f"{self.receiving_application}|{self.receiving_facility}|{timestamp}||"
            f"{message_type}^{trigger_event}|{control_id}|P|2.5.1"
        )

    def _normalize_administrative_gender(self, sex: str) -> str:
        if not sex:
            return "U"
        sex_upper = sex.upper().strip()
        gender_map = {
            "M": "M", "MASCULINO": "M", "HOMBRE": "M", "MALE": "M",
            "F": "F", "FEMENINO": "F", "MUJER": "F", "FEMALE": "F",
            "O": "O", "OTRO": "O", "OTHER": "O",
            "U": "U", "DESCONOCIDO": "U", "UNKNOWN": "U",
            "A": "A", "AMBIGUO": "A", "AMBIGUOUS": "A",
            "N": "N", "NO APLICA": "N", "NOT APPLICABLE": "N"
        }
        return gender_map.get(sex_upper, "U")

    def build_pid_segment(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str
    ) -> str:
        patient_name = self._format_name(last_name, first_name)
        dob = self._format_datetime(birth_date)
        normalized_gender = self._normalize_administrative_gender(sex)
        pid_4 = rut if rut else ""
        return f"PID|||{patient_id}|{pid_4}|{'^'.join(part.strip() for part in patient_name.split(',', 1))}||{dob}|{normalized_gender}"

    def build_pv1_segment(
        self,
        episode_id: str,
        patient_class: str,
        location: Optional[str],
        admission_type: Optional[str],
        admission_datetime: datetime,
        clinical_unit: Optional[str] = None
    ) -> str:
        admission_dt = self._format_datetime(admission_datetime)
        if clinical_unit and location:
            location_str = f"{clinical_unit}^{location}"
        elif clinical_unit:
            location_str = clinical_unit
        elif location:
            location_str = location
        else:
            location_str = ""
        return f"PV1||{patient_class}|{location_str}||||||||||||||||{episode_id}||||||||||||||||||||||||||{admission_dt}"

    def build_pv2_segment(self, motivo_consulta: Optional[str] = None) -> str:
        escaped_motivo = self._escape_text(motivo_consulta) if motivo_consulta else ""
        return f"PV2|||{escaped_motivo}"

    def build_obr_segment(
        self,
        set_id: int,
        test_code: str,
        test_name: str,
        observation_datetime: Optional[datetime] = None,
        sending_user: Optional[str] = None
    ) -> str:
        """
        Build OBR segment. sending_user (OBR.24) must come from the session user,
        never queried from DB here.
        """
        obs_dt = self._format_datetime(observation_datetime) if observation_datetime else self._generate_timestamp()
        user_field = sending_user or ""
        return f"OBR|{set_id}||{test_code}^{test_name}^LOCAL|||{obs_dt}|{obs_dt}|||||||||||||||||||||||||{user_field}"

    def build_obx_segment(
        self,
        set_id: int,
        value_type: str,
        observation_id: str,
        observation_text: str,
        value: str,
        units: str = "",
        observation_datetime: Optional[datetime] = None
    ) -> str:
        escaped_value = self._escape_text(value)
        obs_dt = self._format_datetime(observation_datetime) if observation_datetime else ""
        return f"OBX|{set_id}|{value_type}|{observation_id}^{observation_text}^LOCAL||{escaped_value}||||||F|||{obs_dt}"

    def build_nte_segment(self, set_id: int, note_text: str) -> str:
        escaped_text = self._escape_text(note_text)
        return f"NTE|{set_id}||{escaped_text}"

    def build_evn_segment(self, event_type: str, event_datetime: Optional[datetime] = None) -> str:
        if event_datetime is None:
            event_datetime = datetime.utcnow()
        event_dt = self._format_datetime(event_datetime)
        return f"EVN|{event_type}|{event_dt}"

    def build_a28_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        if not control_id:
            control_id = self._generate_control_id()
        msh = self.build_msh_segment("ADT", "A28", control_id)
        evn = self.build_evn_segment("A28")
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment("", "", "", "", datetime.utcnow())
        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id

    def build_a01_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        patient_class: str,
        location: Optional[str],
        admission_type: Optional[str],
        admission_datetime: datetime,
        motivo_consulta: Optional[str] = None,
        clinical_unit: Optional[str] = None,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        if not control_id:
            control_id = self._generate_control_id()
        msh = self.build_msh_segment("ADT", "A01", control_id)
        evn = self.build_evn_segment("A01", admission_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(episode_id, patient_class, location, admission_type, admission_datetime, clinical_unit)
        pv2 = self.build_pv2_segment(motivo_consulta)
        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r{pv2}\r"
        return message, control_id

    def build_oru_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        observations: list[dict],
        patient_class: str = "O",
        location: Optional[str] = None,
        observation_datetime: Optional[datetime] = None,
        motivo_consulta: Optional[str] = None,
        clinical_unit: Optional[str] = None,
        control_id: Optional[str] = None,
        sending_user: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ORU^R01 message. sending_user is explicitly passed — comes from the
        session user at event creation time, stored in OutboxEvent.author_user_id.
        """
        if not control_id:
            control_id = self._generate_control_id()

        if observation_datetime is None:
            if observations and observations[0].get("datetime"):
                observation_datetime = observations[0]["datetime"]
            else:
                observation_datetime = datetime.utcnow()

        msh = self.build_msh_segment("ORU", "R01", control_id)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(
            episode_id=episode_id,
            patient_class=patient_class,
            location=location,
            admission_type=None,
            admission_datetime=observation_datetime,
            clinical_unit=clinical_unit
        )
        pv2 = self.build_pv2_segment(motivo_consulta)

        segments = [msh, pid, pv1, pv2]

        if observations:
            first_obs = observations[0]
            obr = self.build_obr_segment(
                set_id=1,
                test_code=first_obs.get("observation_id", "CLINICALNOTE"),
                test_name=first_obs.get("observation_text", "Clinical Note"),
                observation_datetime=first_obs.get("datetime"),
                sending_user=sending_user
            )
            segments.append(obr)

            for idx, obs in enumerate(observations, start=1):
                obx = self.build_obx_segment(
                    set_id=idx,
                    value_type=obs.get("value_type", "TX"),
                    observation_id=obs.get("observation_id", "NOTE"),
                    observation_text=obs.get("observation_text", "Clinical Note"),
                    value=obs.get("value", ""),
                    units=obs.get("units", ""),
                    observation_datetime=obs.get("datetime")
                )
                segments.append(obx)

        message = "\r".join(segments) + "\r"
        return message, control_id

    def build_a03_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        discharge_datetime: datetime,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        if not control_id:
            control_id = self._generate_control_id()
        msh = self.build_msh_segment("ADT", "A03", control_id)
        evn = self.build_evn_segment("A03", discharge_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(
            episode_id=episode_id,
            patient_class="O",
            location=None,
            admission_type=None,
            admission_datetime=discharge_datetime
        )
        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id
