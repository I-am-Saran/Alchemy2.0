import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Lock } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { usePermissions } from "../hooks/usePermissions";
import { THEME_COLORS } from "../constants/colors";
import { get } from "../services/api";
import Logo from "./Logo";

export default function TopNavBar() {
  const navigate = useNavigate();
  const { session, setSession, tenantId } = useSession();
  const { userRoles, loading: permsLoading } = usePermissions(tenantId);
  const [roleNamesFromApi, setRoleNamesFromApi] = React.useState([]);

  const handleLogout = () => {
    // Clear session
    setSession(null);
    
    // Clear all storage
    try {
      sessionStorage.clear();
      localStorage.clear();
      // Explicitly clear password_changed flag
      localStorage.removeItem('password_changed');
    } catch {}

    // Hard refresh browser (like Ctrl+Shift+R) - navigate to login and reload
    window.location.replace("/login");
    window.location.reload();
  };

  // Fetch role names directly from API if extraction fails
  React.useEffect(() => {
    const fetchRoleNames = async () => {
      if (permsLoading || !userRoles || userRoles.length === 0) {
        return;
      }

      // Try to extract role names first
      const extractedNames = userRoles
        .map((userRole) => {
          if (userRole?.roles?.role_name) return userRole.roles.role_name;
          if (Array.isArray(userRole?.roles) && userRole.roles.length > 0) {
            return userRole.roles[0]?.role_name;
          }
          if (userRole?.role_name) return userRole.role_name;
          return null;
        })
        .filter((name) => name);

      // If we successfully extracted names, use them
      if (extractedNames.length > 0) {
        setRoleNamesFromApi(extractedNames);
        return;
      }

      // Otherwise, fetch role details from API using role_id
      const roleIds = userRoles
        .map((userRole) => {
          if (userRole.role_id) return userRole.role_id;
          if (userRole?.roles?.id) return userRole.roles.id;
          if (Array.isArray(userRole?.roles) && userRole.roles.length > 0) {
            return userRole.roles[0]?.id;
          }
          return null;
        })
        .filter((id) => id);

      if (roleIds.length === 0) {
        setRoleNamesFromApi([]);
        return;
      }

      try {
        const roleNamePromises = roleIds.map(async (roleId) => {
          try {
            const roleJson = await get(`/api/roles/${roleId}?tenant_id=${tenantId}`);
            return roleJson?.data?.role_name || null;
          } catch (err) {
            console.warn(`[TopNavBar] Failed to fetch role ${roleId}:`, err);
            return null;
          }
        });

        const names = await Promise.all(roleNamePromises);
        const validNames = names.filter((name) => name);
        setRoleNamesFromApi(validNames);
      } catch (err) {
        console.error("[TopNavBar] Error fetching role names:", err);
        setRoleNamesFromApi([]);
      }
    };

    fetchRoleNames();
  }, [userRoles, permsLoading, tenantId]);

  // Extract role names from userRoles
  // Handle both nested structure (roles.role_name) and direct structure
  const roleNames = React.useMemo(() => {
    if (permsLoading) {
      return "Loading...";
    }
    
    if (!userRoles || userRoles.length === 0) {
      return "No Role";
    }
    
    const names = userRoles
      .map((userRole) => {
        // Try different possible structures
        // Structure 1: userRole.roles.role_name (nested object from Supabase join)
        if (userRole?.roles?.role_name) {
          return userRole.roles.role_name;
        }
        
        // Structure 2: userRole.roles[0].role_name (array of roles)
        if (Array.isArray(userRole?.roles) && userRole.roles.length > 0) {
          const roleName = userRole.roles[0]?.role_name;
          if (roleName) {
            return roleName;
          }
        }
        
        // Structure 3: userRole.role_name (direct property)
        if (userRole?.role_name) {
          return userRole.role_name;
        }
        
        // Structure 4: Check if roles object exists but role_name is at a different level
        if (userRole?.roles) {
          const rolesObj = userRole.roles;
          if (typeof rolesObj === 'object' && !Array.isArray(rolesObj)) {
            // Try roles.role_name, roles.name, etc.
            const possibleKeys = ['role_name', 'name', 'roleName'];
            for (const key of possibleKeys) {
              if (rolesObj[key]) {
                return rolesObj[key];
              }
            }
          }
        }
        
        // Structure 5: If we have role_id, try to get role name from the roles data that might be nested differently
        // Sometimes Supabase returns the joined data in a different format
        if (userRole?.role_id && userRole?.roles) {
          // Check if roles is an object with the role data
          const roleData = typeof userRole.roles === 'object' && !Array.isArray(userRole.roles) 
            ? userRole.roles 
            : (Array.isArray(userRole.roles) && userRole.roles.length > 0 ? userRole.roles[0] : null);
          
          if (roleData && roleData.role_name) {
            return roleData.role_name;
          }
        }
        
        return null;
      })
      .filter((name) => name);
    
    // If we couldn't extract names but have them from API, use those
    if (names.length === 0 && roleNamesFromApi.length > 0) {
      return roleNamesFromApi.join(", ");
    }
    
    return names.length > 0 ? names.join(", ") : "No Role";
  }, [userRoles, permsLoading, roleNamesFromApi]);

  // Get user info from session
  const userName = session?.user?.full_name || session?.user?.name || "User";
  const userEmail = session?.user?.email || "";

  return (
    <nav className="navbar navbar-expand-lg shadow-sm sticky-top" style={{ backgroundColor: THEME_COLORS.offWhite, borderBottom: `1px solid ${THEME_COLORS.lightBlue}`, zIndex: 1050 }}>
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between w-100">
          {/* Left: Logo and App Name */}
          <div className="d-flex align-items-center">
            <Logo variant="with-subtitle" size="default" />
          </div>

          {/* Right: User Info and Logout Button */}
          {session && (
            <div className="d-flex align-items-center gap-3">
              {/* User Info */}
              <div className="d-flex align-items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: `${THEME_COLORS.lightBlue}15`, border: `1px solid ${THEME_COLORS.lightBlue}30` }}>
                <User size={18} style={{ color: THEME_COLORS.lightBlue }} />
                <div className="d-flex flex-column">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: THEME_COLORS.darkTeal }}>
                      {userName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: THEME_COLORS.lightBlue, fontWeight: '500' }}>
                      ({roleNames})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    {userEmail}
                  </span>
                </div>
              </div>

              {/* Change Password Button */}
              <button
                type="button"
                onClick={() => navigate("/change-password")}
                className="btn btn-sm d-flex align-items-center justify-content-center"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  padding: '0',
                  backgroundColor: THEME_COLORS.mediumTeal,
                  border: `1px solid ${THEME_COLORS.mediumTeal}`,
                  color: 'white'
                }}
                title="Change Password"
                aria-label="Change Password"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = THEME_COLORS.darkTeal;
                  e.currentTarget.style.borderColor = THEME_COLORS.darkTeal;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = THEME_COLORS.mediumTeal;
                  e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal;
                }}
              >
                <Lock size={18} />
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-danger btn-sm d-flex align-items-center justify-content-center"
                style={{ width: '40px', height: '40px', padding: '0' }}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

