import hl7
from datetime import datetime
from typing import Tuple, Optional


def parse_hl7_message(message: str) -> Tuple[bool, Optional[str], Optional[dict]]:
    """
    Parse HL7 message and extract relevant information.

    Returns:
        Tuple of (success, error_message, parsed_data)
    """
    try:
        parsed = hl7.parse(message)

        msh = parsed.segment('MSH')
        if not msh:
            return False, "Missing MSH segment", None

        message_type = str(msh[9]) if len(msh) > 9 else "UNKNOWN"
        control_id = str(msh[10]) if len(msh) > 10 else f"AUTO_{datetime.utcnow().timestamp()}"
        sending_app = str(msh[3]) if len(msh) > 3 else "UNKNOWN"

        data = {
            "message_type": message_type,
            "control_id": control_id,
            "sending_app": sending_app,
            "timestamp": datetime.utcnow()
        }

        return True, None, data

    except Exception as e:
        return False, f"HL7 parsing error: {str(e)}", None


def generate_ack(
    message_control_id: str,
    ack_code: str = "AA",
    error_message: Optional[str] = None
) -> str:
    """
    Generate HL7 ACK message.

    ACK codes:
    - AA: Application Accept
    - AE: Application Error
    - AR: Application Reject
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    msh = f"MSH|^~\\&|CENTRAL|HOSPITAL|OFFLINE|LOCAL|{timestamp}||ACK|{message_control_id}|P|2.5"
    msa = f"MSA|{ack_code}|{message_control_id}"

    if error_message and ack_code != "AA":
        msa += f"|{error_message}"

    ack_message = f"{msh}\r{msa}\r"

    return ack_message


def validate_hl7_message(message: str) -> Tuple[bool, Optional[str]]:
    """
    Validate HL7 message structure.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not message or len(message.strip()) == 0:
        return False, "Empty message"

    if not message.startswith("MSH"):
        return False, "Message must start with MSH segment"

    segments = message.split('\r')
    if len(segments) < 2:
        return False, "Message must contain at least 2 segments"

    return True, None


def extract_patient_data(parsed_hl7) -> Optional[dict]:
    """
    Extract patient data from HL7 message (PID segment).
    """
    try:
        pid = parsed_hl7.segment('PID')
        if not pid:
            return None

        return {
            "patient_id": str(pid[3]) if len(pid) > 3 else None,
            "name": str(pid[5]) if len(pid) > 5 else None,
            "birth_date": str(pid[7]) if len(pid) > 7 else None,
            "sex": str(pid[8]) if len(pid) > 8 else None
        }
    except Exception:
        return None


def extract_visit_data(parsed_hl7) -> Optional[dict]:
    """
    Extract visit/episode data from HL7 message (PV1 segment).
    """
    try:
        pv1 = parsed_hl7.segment('PV1')
        if not pv1:
            return None

        return {
            "visit_id": str(pv1[2]) if len(pv1) > 2 else None,
            "patient_class": str(pv1[3]) if len(pv1) > 3 else None,
            "assigned_location": str(pv1[4]) if len(pv1) > 4 else None,
            "admission_type": str(pv1[5]) if len(pv1) > 5 else None
        }
    except Exception:
        return None
