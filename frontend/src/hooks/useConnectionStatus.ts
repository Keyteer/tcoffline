import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useConnectionStatus(intervalSeconds = 8) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const centralHealth = await api.getCentralHealth();
      setIsOnline(centralHealth.status === 'online');
      setLastCheck(new Date());
    } catch (error) {
      setIsOnline(false);
      setLastCheck(new Date());
    }
  }, []);

  const syncFromCentral = useCallback(async () => {
    try {
      await api.syncFromCentral();
      window.dispatchEvent(new CustomEvent('sync-from-central'));
    } catch (error) {
      console.error('Error syncing from central:', error);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const interval = setInterval(checkStatus, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [checkStatus, intervalSeconds]);

  return { isOnline, lastCheck, checkStatus, syncFromCentral };
}
