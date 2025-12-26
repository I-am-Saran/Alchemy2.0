import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../contexts/SessionContext';
import { get } from '../services/api';

/**
 * Hook to fetch tasks with React Query caching
 * @param {string} controlIdFilter - Optional control ID to filter tasks
 */
export function useTasks(controlIdFilter = '') {
  const { session, loading: sessionLoading } = useSession();
  
  return useQuery({
    queryKey: ['tasks', controlIdFilter, session?.tenant_id],
    queryFn: async () => {
      if (!session) return [];
      
      const tenant_id = session.tenant_id || '00000000-0000-0000-0000-000000000001';
      const url = controlIdFilter
        ? `/api/tasks/control/${encodeURIComponent(controlIdFilter)}?tenant_id=${encodeURIComponent(tenant_id)}`
        : `/api/tasks?tenant_id=${encodeURIComponent(tenant_id)}`;
      
      const json = await get(url);
      if (json.error) {
        const errorMsg = typeof json.error === 'string' 
          ? json.error 
          : json.error?.message || json.error?.detail || JSON.stringify(json.error);
        throw new Error(errorMsg);
      }
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !sessionLoading && !!session, // Only fetch when session is loaded and available
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to invalidate tasks cache (useful after mutations)
 */
export function useInvalidateTasks() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };
}

