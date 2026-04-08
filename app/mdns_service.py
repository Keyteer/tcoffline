"""mDNS hostname advertisement so clients can reach the backend at a .local address."""

import socket
import logging
from zeroconf import ServiceInfo, Zeroconf

logger = logging.getLogger(__name__)

_zeroconf: Zeroconf | None = None
_service_info: ServiceInfo | None = None


def _get_local_ip() -> str:
    """Best-effort detection of the machine's LAN IP address."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def _is_docker() -> bool:
    """Detect if we are running inside a Docker container."""
    try:
        with open("/proc/1/cgroup", "r") as f:
            return "docker" in f.read()
    except Exception:
        return False


def start_mdns(mdns_hostname: str, port: int = 8000) -> None:
    """
    Register an mDNS hostname so that ``<mdns_hostname>.local`` resolves to
    this machine's LAN IP.  A dummy ``_http._tcp`` service is created because
    zeroconf requires a service record to advertise the A record.
    """
    global _zeroconf, _service_info

    ip = _get_local_ip()
    fqdn = f"{mdns_hostname}.local."

    if ip == "127.0.0.1":
        logger.warning(
            "mDNS: detected IP is 127.0.0.1 – clients on other devices won't "
            "be able to reach this backend.  Check network connectivity."
        )

    if _is_docker():
        logger.warning(
            "mDNS: running inside Docker. Unless network_mode=host is set, "
            "multicast won't reach the LAN and %s will NOT resolve for clients.",
            fqdn,
        )

    _service_info = ServiceInfo(
        type_="_http._tcp.local.",
        name=f"{mdns_hostname}._http._tcp.local.",
        addresses=[socket.inet_aton(ip)],
        port=port,
        properties={
            "service": "trakcare_offline",
            "version": "2.0.0",
        },
        server=fqdn,
    )

    _zeroconf = Zeroconf()
    _zeroconf.register_service(_service_info)
    logger.info("mDNS: registered %s -> %s:%s", fqdn, ip, port)

    # Self-check: verify the A record is resolvable
    check = _zeroconf.get_service_info(
        "_http._tcp.local.",
        f"{mdns_hostname}._http._tcp.local.",
        timeout=3000,
    )
    if check and check.addresses:
        logger.info("mDNS: self-check OK – hostname is resolvable")
    else:
        logger.warning("mDNS: self-check FAILED – hostname may not resolve for clients")


def stop_mdns() -> None:
    """Unregister the mDNS service."""
    global _zeroconf, _service_info
    if _zeroconf and _service_info:
        _zeroconf.unregister_service(_service_info)
        _zeroconf.close()
        _zeroconf = None
        _service_info = None
        logger.info("mDNS: service unregistered")
