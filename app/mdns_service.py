"""mDNS/Zeroconf advertisement so mobile/desktop clients can auto-discover the backend."""

import socket
import logging
from zeroconf import ServiceInfo, Zeroconf

logger = logging.getLogger(__name__)

_zeroconf: Zeroconf | None = None
_service_info: ServiceInfo | None = None


def get_local_ip() -> str:
    """Best-effort detection of the machine's LAN IP address."""
    try:
        # Connect to an external address to determine the preferred outbound IP.
        # No data is actually sent.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def start_mdns(server_name: str, port: int = 8000) -> None:
    """Register the TrakCare Offline service on the local network via mDNS."""
    global _zeroconf, _service_info

    ip = get_local_ip()
    hostname = socket.gethostname()

    _service_info = ServiceInfo(
        type_="_http._tcp.local.",
        name=f"{server_name}._http._tcp.local.",
        addresses=[socket.inet_aton(ip)],
        port=port,
        properties={
            "service": "trakcare_offline",
            "version": "2.0.0",
            "hostname": hostname,
        },
        server=f"{hostname}.local.",
    )

    _zeroconf = Zeroconf()
    _zeroconf.register_service(_service_info)
    logger.info(f"mDNS: advertising '{server_name}' at {ip}:{port}")


def stop_mdns() -> None:
    """Unregister the mDNS service."""
    global _zeroconf, _service_info
    if _zeroconf and _service_info:
        _zeroconf.unregister_service(_service_info)
        _zeroconf.close()
        _zeroconf = None
        _service_info = None
        logger.info("mDNS: service unregistered")
