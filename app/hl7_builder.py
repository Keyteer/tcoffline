from datetime import datetime
from typing import Optional
from app.db import SessionLocal
from app import models
import uuid


class HL7MessageBuilder:
    """
    Builder for HL7 v2.5 messages.
    Supports A28 (Add Patient), A01 (Admit Patient), ORU (Observation Result).
    """

    def __init__(
        self,
        sending_application: str = "OFFLINE",
        sending_facility: str = "LOCAL",
        receiving_application: str = "CENTRAL",
        receiving_facility: str = "HOSPITAL"
    ):
        self.sending_application = sending_application
        self.sending_facility = sending_facility
        self.receiving_application = receiving_application
        self.receiving_facility = receiving_facility

    def _generate_timestamp(self) -> str:
        """Generate HL7 timestamp format: YYYYMMDDHHMMSS"""
        return datetime.utcnow().strftime("%Y%m%d%H%M%S")

    def _generate_control_id(self) -> str:
        """Generate unique message control ID"""
        return str(uuid.uuid4())[:20].replace("-", "").upper()

    def _format_name(self, last_name: str, first_name: str) -> str:
        """Format name as Last^First"""
        return f"{last_name}^{first_name}"

    def _format_datetime(self, dt: datetime) -> str:
        """Format datetime to HL7 format"""
        return dt.strftime("%Y%m%d%H%M%S") if dt else ""

    def _escape_text(self, text: str) -> str:
        """Escape special HL7 characters"""
        if not text:
            return ""
        text = text.replace("\\", "\\E\\")
        text = text.replace("|", "\\F\\")
        text = text.replace("^", "\\S\\")
        text = text.replace("&", "\\T\\")
        text = text.replace("~", "\\R\\")
        return text

    def build_msh_segment(
        self,
        message_type: str,
        trigger_event: str,
        control_id: Optional[str] = None
    ) -> str:
        """
        Build MSH (Message Header) segment.

        Args:
            message_type: Message type (e.g., "ADT", "ORU")
            trigger_event: Trigger event (e.g., "A01", "A28", "R01")
            control_id: Message control ID (generated if not provided)
        """
        if not control_id:
            control_id = self._generate_control_id()

        timestamp = self._generate_timestamp()

        msh = (
            f"MSH|^~\\&|{self.sending_application}|{self.sending_facility}|"
            f"{self.receiving_application}|{self.receiving_facility}|{timestamp}||"
            f"{message_type}^{trigger_event}|{control_id}|P|2.5.1"
        )
        return msh

    def _normalize_administrative_gender(self, sex: str) -> str:
        """
        Normalize gender to HL7 Administrative Gender table (HL70001).

        Valid values:
        - F: Female
        - M: Male
        - O: Other
        - U: Unknown
        - A: Ambiguous
        - N: Not applicable
        """
        if not sex:
            return "U"

        sex_upper = sex.upper().strip()

        # Map common Spanish values
        gender_map = {
            "M": "M",
            "MASCULINO": "M",
            "HOMBRE": "M",
            "MALE": "M",
            "F": "F",
            "FEMENINO": "F",
            "MUJER": "F",
            "FEMALE": "F",
            "O": "O",
            "OTRO": "O",
            "OTHER": "O",
            "U": "U",
            "DESCONOCIDO": "U",
            "UNKNOWN": "U",
            "A": "A",
            "AMBIGUO": "A",
            "AMBIGUOUS": "A",
            "N": "N",
            "NO APLICA": "N",
            "NOT APPLICABLE": "N"
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
        """
        Build PID (Patient Identification) segment.

        Args:
            patient_id: Local patient ID (UUID)
            rut: National ID (RUT)
            last_name: Patient last name
            first_name: Patient first name
            birth_date: Date of birth
            sex: Sex/Gender (will be normalized to HL7 Administrative Gender table)

        Structure:
            PID:3 = patient_id (always)
            PID:4 = rut (only if available)
            PID:5 = patient name
        """
        patient_name = self._format_name(last_name, first_name)
        dob = self._format_datetime(birth_date)
        normalized_gender = self._normalize_administrative_gender(sex)

        # PID:3 always contains patient_id, PID:4 contains RUT if available
        pid_4 = rut if rut else ""

        pid = (
            #f"PID|||{patient_id}|{pid_4}|{patient_name.replace(",","^")}||{dob}|{normalized_gender}"
            f"PID|||{patient_id}|{pid_4}|{'^'.join(part.strip() for part in patient_name.split(',', 1))}||{dob}|{normalized_gender}"
        )
        return pid

    def build_pv1_segment(
        self,
        episode_id: str,
        patient_class: str,
        location: Optional[str],
        admission_type: Optional[str],
        admission_datetime: datetime,
        clinical_unit: Optional[str] = None
    ) -> str:
        """
        Build PV1 (Patient Visit) segment.

        Args:
            episode_id: Episode/visit ID (UUID)
            patient_class: Patient class (I=Inpatient, O=Outpatient, E=Emergency)
            location: Location (room/box/habitacion)
            admission_type: Type of admission
            admission_datetime: Admission date and time
            clinical_unit: Clinical unit (ubicacion)

        Field PV1.3 contains the location in format: clinical_unit^room^bed
        Field PV1.19 contains the Visit Number (episode_id)
        """
        admission_dt = self._format_datetime(admission_datetime)

        # Build location string: clinical_unit^room^bed
        # If we have both clinical_unit and location (room), combine them
        # Otherwise use whatever we have
        if clinical_unit and location:
            location_str = f"{clinical_unit}^{location}"
        elif clinical_unit:
            location_str = clinical_unit
        elif location:
            location_str = location
        else:
            location_str = ""

        # PV1 segment with Visit Number in field 19
        # Fields: 1(empty), 2(class), 3(location), 4-18(empty), 19(visit number), 20-44(empty), 45(admission datetime)
        pv1 = (
            f"PV1||{patient_class}|{location_str}||||||||||||||||{episode_id}||||||||||||||||||||||||||{admission_dt}"
        )
        return pv1

    def build_pv2_segment(self, motivo_consulta: Optional[str] = None) -> str:
        """
        Build PV2 (Patient Visit - Additional Info) segment.

        Args:
            motivo_consulta: Reason for consultation/visit (goes in PV2.3)

        Returns:
            PV2 segment string
        """
        escaped_motivo = self._escape_text(motivo_consulta) if motivo_consulta else ""

        # PV2 segment with Admit Reason in field 3
        pv2 = f"PV2|||{escaped_motivo}"
        return pv2

    def build_obr_segment(
        self,
        set_id: int,
        test_code: str,
        test_name: str,
        observation_datetime: Optional[datetime] = None
    ) -> str:
        """
        Build OBR (Observation Request) segment.

        Args:
            set_id: Sequence number
            test_code: Test/observation code
            test_name: Test/observation name
            observation_datetime: Date/time of observation
        """

        db = SessionLocal()
        most_recent_user = db.query(models.User).filter(
                models.User.active == True,
                models.User.last_login.isnot(None)
            ).order_by(models.User.last_login.desc()).first()

        user = ""
        if most_recent_user and most_recent_user.filtros:
            try:
                user = dict(x.split('=') for x in most_recent_user.filtros.split('&') if '=' in x).get('user', '')
            except Exception:
                pass

        obs_dt = self._format_datetime(observation_datetime) if observation_datetime else self._generate_timestamp()

        obr = f"OBR|{set_id}||{test_code}^{test_name}^LOCAL|||{obs_dt}|{obs_dt}|||||||||||||||||||||||||{user}"
        return obr

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
        """
        Build OBX (Observation/Result) segment.

        Args:
            set_id: Sequence number
            value_type: Type of value (ST=String, NM=Numeric, TX=Text)
            observation_id: Observation identifier
            observation_text: Observation description
            value: Observation value
            units: Units of measure
            observation_datetime: Date/time of observation
        """
        escaped_value = self._escape_text(value)
        obs_dt = self._format_datetime(observation_datetime) if observation_datetime else ""

        obx = (
            f"OBX|{set_id}|{value_type}|{observation_id}^{observation_text}^LOCAL||  {escaped_value}||||||F|||{obs_dt}"
        )
        return obx

    def build_nte_segment(self, set_id: int, note_text: str) -> str:
        """
        Build NTE (Notes and Comments) segment.

        Args:
            set_id: Sequence number
            note_text: Note text
        """
        escaped_text = self._escape_text(note_text)
        nte = f"NTE|{set_id}||{escaped_text}"
        return nte

    def build_evn_segment(self, event_type: str, event_datetime: Optional[datetime] = None) -> str:
        """
        Build EVN (Event Type) segment.

        Args:
            event_type: Event type code (A01, A28, etc.)
            event_datetime: Event date/time (defaults to current time)
        """
        if event_datetime is None:
            event_datetime = datetime.utcnow()

        event_dt = self._format_datetime(event_datetime)
        evn = f"EVN|{event_type}|{event_dt}"
        return evn

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
        """
        Build ADT^A28 (Add Person Information) message.
        Used for registering new patients.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        msh = self.build_msh_segment("ADT", "A28", control_id)
        evn = self.build_evn_segment("A28")
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment("", "", "", "", datetime.utcnow())

        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id

    def build_a08_message(
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
        """
        Build ADT^A08 (Update Patient Information) message.
        Used when an existing episode's data is modified.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        msh = self.build_msh_segment("ADT", "A08", control_id)
        evn = self.build_evn_segment("A08", admission_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(episode_id, patient_class, location, admission_type, admission_datetime, clinical_unit)
        pv2 = self.build_pv2_segment(motivo_consulta)

        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r{pv2}\r"
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
        """
        Build ADT^A01 (Admit/Visit Notification) message.
        Used for patient admissions.

        Args:
            location: Room/box/habitacion
            clinical_unit: Clinical unit/ubicacion
            motivo_consulta: Reason for consultation (included in PV2.3)

        Returns:
            Tuple of (message, control_id)
        """
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
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ORU^R01 (Observation Report) message.
        Used for clinical observations and results.

        Args:
            observations: List of dicts with keys: observation_id, observation_text, value, value_type, units, datetime
            patient_class: Patient class (default "O" for Outpatient)
            location: Location (optional)
            observation_datetime: Datetime for PV1 segment (defaults to first observation datetime or current time)
            motivo_consulta: Reason for consultation (included in PV2.3)
            clinical_unit: Clinical unit/ubicacion

        Returns:
            Tuple of (message, control_id)
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
                observation_datetime=first_obs.get("datetime")
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
        """
        Build ADT^A03 (Discharge Patient) message.
        Used for patient discharges.

        Returns:
            Tuple of (message, control_id)
        """
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

    def build_a11_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        event_datetime: Optional[datetime] = None,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ADT^A11 (Cancel Admit/Visit Notification) message.
        Used to undo an erroneous A01/A04.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        if event_datetime is None:
            event_datetime = datetime.utcnow()

        msh = self.build_msh_segment("ADT", "A11", control_id)
        evn = self.build_evn_segment("A11", event_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(
            episode_id=episode_id,
            patient_class="O",
            location=None,
            admission_type=None,
            admission_datetime=event_datetime
        )

        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id

    def build_a13_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        event_datetime: Optional[datetime] = None,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ADT^A13 (Cancel Discharge) message.
        Used to undo an erroneous A03.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        if event_datetime is None:
            event_datetime = datetime.utcnow()

        msh = self.build_msh_segment("ADT", "A13", control_id)
        evn = self.build_evn_segment("A13", event_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(
            episode_id=episode_id,
            patient_class="O",
            location=None,
            admission_type=None,
            admission_datetime=event_datetime
        )

        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id

    def build_a23_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        episode_id: str,
        event_datetime: Optional[datetime] = None,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ADT^A23 (Delete a Patient Record) message.
        Used to delete visit/episode-level data while keeping the person record.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        if event_datetime is None:
            event_datetime = datetime.utcnow()

        msh = self.build_msh_segment("ADT", "A23", control_id)
        evn = self.build_evn_segment("A23", event_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)
        pv1 = self.build_pv1_segment(
            episode_id=episode_id,
            patient_class="O",
            location=None,
            admission_type=None,
            admission_datetime=event_datetime
        )

        message = f"{msh}\r{evn}\r{pid}\r{pv1}\r"
        return message, control_id

    def build_a29_message(
        self,
        patient_id: str,
        rut: Optional[str],
        last_name: str,
        first_name: str,
        birth_date: datetime,
        sex: str,
        event_datetime: Optional[datetime] = None,
        control_id: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Build ADT^A29 (Delete Person Information) message.
        Used to remove a patient (PID-level) entirely from the central system.

        Returns:
            Tuple of (message, control_id)
        """
        if not control_id:
            control_id = self._generate_control_id()

        if event_datetime is None:
            event_datetime = datetime.utcnow()

        msh = self.build_msh_segment("ADT", "A29", control_id)
        evn = self.build_evn_segment("A29", event_datetime)
        pid = self.build_pid_segment(patient_id, rut, last_name, first_name, birth_date, sex)

        message = f"{msh}\r{evn}\r{pid}\r"
        return message, control_id
