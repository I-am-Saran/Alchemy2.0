import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../contexts/SessionContext';
import { get } from '../services/api';

/**
 * Hook to fetch security controls with React Query caching
 * @param {string} certification - Required certification filter (only fetches when provided)
 */
export function useSecurityControls(certification = null) {
  const { session, loading: sessionLoading } = useSession();
  
  // Determine if we should fetch - only when certification is a non-empty string
  const certValue = certification ? String(certification).trim() : '';
  const shouldFetch = !sessionLoading && certValue !== '';
  
  return useQuery({
    queryKey: ['security-controls', certValue],
    queryFn: async () => {
      if (!certValue) {
        return [];
      }
      const url = `/api/security-controls?certification=${encodeURIComponent(certValue)}`;
      const json = await get(url);
      if (json.error) throw new Error(json.error);
      return json.data || [];
    },
    enabled: shouldFetch, // Only fetch when session is loaded AND certification is selected
    staleTime: 0, // Always consider data stale - refetch when certification changes
    gcTime: 5 * 60 * 1000, // Keep unused cache for 5 minutes (formerly cacheTime)
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus (optional)
    keepPreviousData: false, // Don't show previous certification's data when switching
  });
}

/**
 * Hook to fetch certifications from security_controls table only
 * Gets unique certification values from the security_controls table's certification column
 */
export function useCertifications() {
  const { session, loading: sessionLoading } = useSession();
  
  return useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      const tenant_id = session?.tenant_id || '00000000-0000-0000-0000-000000000001';
      
      // Fetch unique certifications from security_controls table only
      const controlsJson = await get(`/api/certifications/from-controls?tenant_id=${encodeURIComponent(tenant_id)}`);
      if (controlsJson.error) throw new Error(controlsJson.error);
      
      // Return as array of strings for dropdown (already sorted from backend)
      return controlsJson.data || [];
    },
    enabled: !sessionLoading,
    staleTime: 10 * 60 * 1000, // 10 minutes (certifications change less frequently)
  });
}

/**
 * Hook to invalidate security controls cache (useful after mutations)
 */
export function useInvalidateSecurityControls() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['security-controls'] });
  };
}

