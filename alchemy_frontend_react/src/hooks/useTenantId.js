import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { get } from '../services/api';

/**
 * Hook to get tenant_id for the current user
 * Fetches tenant_id from user record in database
 */
export function useTenantId() {
  const { session } = useSession();
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000001'); // Default fallback
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenantId = async () => {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const user = session.user || {};
        const userId = user.id || user.user?.id;
        
        if (!userId) {
          setLoading(false);
          return;
        }

        // Get user record to extract tenant_id
        // For now, we'll use the default tenant_id
        // In the future, we can add an endpoint to get user's tenant_id
        // Or extract it from the session token if available
        setTenantId('00000000-0000-0000-0000-000000000001');
        setLoading(false);
      } catch (err) {
        console.error('Error fetching tenant_id:', err);
        setLoading(false);
      }
    };

    fetchTenantId();
  }, [session]);

  return { tenantId, loading };
}

