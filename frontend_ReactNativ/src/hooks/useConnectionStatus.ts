import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

/** Tri-state central HIS connection status.
 *  'online'  = reachable with valid TLS cert
 *  'warning' = reachable but self-signed / invalid cert (SSL retry path)
 *  'offline' = unreachable or backend hasn't implemented the status field
 */
export type CentralStatus = 'online' | 'warning' | 'offline';

export function useConnectionStatus(intervalSeconds = 8) {
  const [isOnline, setIsOnline] = useState(true);
  const [centralStatus, setCentralStatus] = useState<CentralStatus>('offline');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const centralHealth = await api.getCentralHealth();
      // The hospital server returns `status` as a tri-state string when it
      // supports SSL retry.  Fall back to the binary `is_online`-style check
      // on older backends that only return `{ status: 'online' | 'offline' }`.
      const status: CentralStatus =
        centralHealth.status === 'online'
          ? 'online'
          : centralHealth.status === 'warning'
          ? 'warning'
          : 'offline';
      setIsOnline(status === 'online' || status === 'warning');
      setCentralStatus(status);
      setLastCheck(new Date());
    } catch {
      setIsOnline(false);
      setCentralStatus('offline');
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const interval = setInterval(checkStatus, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [checkStatus, intervalSeconds]);

  return { isOnline, centralStatus, lastCheck, checkStatus };
}
