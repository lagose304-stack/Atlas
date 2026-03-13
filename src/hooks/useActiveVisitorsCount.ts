import { useEffect, useState } from 'react';
import { fetchActiveVisitorsCount, heartbeatPresence } from '../services/onlinePresence';

const HEARTBEAT_INTERVAL_MS = 25 * 1000;
const COUNT_REFRESH_INTERVAL_MS = 20 * 1000;

export const useActiveVisitorsCount = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const refreshCount = async () => {
      const next = await fetchActiveVisitorsCount();
      if (mounted) {
        setCount(next);
      }
    };

    const sendHeartbeat = async () => {
      await heartbeatPresence();
      await refreshCount();
    };

    void sendHeartbeat();

    const heartbeatInterval = window.setInterval(() => {
      void heartbeatPresence();
    }, HEARTBEAT_INTERVAL_MS);

    const countInterval = window.setInterval(() => {
      void refreshCount();
    }, COUNT_REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      window.clearInterval(heartbeatInterval);
      window.clearInterval(countInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return count;
};
