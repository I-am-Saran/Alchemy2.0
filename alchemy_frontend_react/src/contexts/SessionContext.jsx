import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);

  // Get access token from cache (synchronous)
  const getAccessToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('auth_token') || null;
    }
    return null;
  }, []);

  // Restore session from storage - IMMEDIATE validation on mount
  useEffect(() => {
    const validateSession = () => {
      try {
        const token = sessionStorage.getItem('auth_token');
        const userStr = localStorage.getItem('user');
        
        // CRITICAL: If no session in browser storage, immediately clear and mark as no session
        if (!token || !userStr) {
          // Ensure storage is cleared
          try {
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('user');
          } catch {}
          setSession(null);
          return false;
        }
        
        // Parse and validate user data
        try {
          const user = JSON.parse(userStr);
          
          // Validate user object has required fields
          if (!user || !user.id || !user.tenant_id) {
            // Invalid user data - clear and redirect
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            setSession(null);
            return false;
          }
          
          // Session valid - set it
          setSession({
            token,
            user,
            user_id: user.id,
            tenant_id: user.tenant_id,
          });
          return true;
        } catch (e) {
          // Invalid JSON - clear and redirect
          sessionStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          setSession(null);
          return false;
        }
      } catch (err) {
        // Any error - clear session
        try {
          sessionStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        } catch {}
        setSession(null);
        return false;
      }
    };

    // Immediate synchronous validation
    validateSession();
    setLoading(false);
    setRestored(true);
  }, []);

  // Expose setSession for login
  const updateSession = useCallback((newSession) => {
    if (newSession) {
      // Set session state
      setSession(newSession);
      // Store in browser storage
      sessionStorage.setItem('auth_token', newSession.token);
      localStorage.setItem('user', JSON.stringify(newSession.user));
    } else {
      // Clear session state
      setSession(null);
      // Clear browser storage
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }, []);

  const value = {
    session,
    loading,
    restored,
    getAccessToken,
    setSession: updateSession,
    tenantId: session?.tenant_id || null,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
