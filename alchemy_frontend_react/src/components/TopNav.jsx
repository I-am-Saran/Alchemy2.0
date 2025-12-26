import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { usePermissions } from "../hooks/usePermissions";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { THEME_COLORS } from "../constants/colors";
import { get } from "../services/api";
import Logo from "./Logo";

export default function TopNav({ open, onClose }) {
  const location = useLocation();
  const { session, setSession, tenantId } = useSession();
  const { hasPermission, loading: permsLoading, userRoles } = usePermissions(tenantId);
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if user is superadmin
  const isSuperAdmin = userRoles.some(
    (userRole) => userRole?.roles?.role_name?.toLowerCase() === 'super admin'
  );

  // Helper function to check if user has permission or is superadmin
  const canAccess = (module, action) => {
    return isSuperAdmin || hasPermission(module, action);
  };

  // Main menu items that should be visible
  const mainMenuItems = [
    {
      name: "Security Controls",
      path: "/security-controls",
      icon: MODULE_ICONS.security_controls,
      module: "security_controls",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.mediumTeal, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.mediumTeal}50` }
    },
    {
      name: "Tasks",
      path: "/tasks",
      icon: MODULE_ICONS.tasks,
      module: "tasks",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.lightMint, to: THEME_COLORS.mediumTeal, shadow: `${THEME_COLORS.lightMint}50` }
    },
    {
      name: "Users",
      path: "/users",
      icon: MODULE_ICONS.users,
      module: "users",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.darkTealLight, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.darkTeal}50` }
    },
    {
      name: "Roles",
      path: "/roles",
      icon: MODULE_ICONS.roles,
      module: "roles",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.mediumTeal, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.mediumTeal}50` }
    },
  ];

  // Filter main menu items based on permissions (superadmin sees all)
  const visibleMainMenuItems = mainMenuItems.filter(item => {
    if (isSuperAdmin) return true;
    return canAccess(item.module, item.permission);
  });

  // Fetch certifications only if user has retrieve permission or is superadmin
  useEffect(() => {
    const fetchCertifications = async () => {
      if (!session || permsLoading) {
        setLoading(false);
        return;
      }

      // Superadmin can see all certifications, bypass permission check
      if (!isSuperAdmin && !hasPermission('certifications', 'retrieve')) {
        console.log('User does not have permission to retrieve certifications');
        setCertifications([]);
        setLoading(false);
        return;
      }

      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(`/api/certifications?tenant_id=${encodeURIComponent(tenant_id)}`);
        if (json.error) {
          console.error('Error fetching certifications:', json.error);
          setCertifications([]);
        } else {
          // Handle different response formats
          let certs = [];
          if (Array.isArray(json.data)) {
            certs = json.data;
          } else if (Array.isArray(json)) {
            certs = json;
          } else if (json.status === "success" && Array.isArray(json.data)) {
            certs = json.data;
          }
          
          console.log('Fetched certifications:', certs.length, certs);
          setCertifications(certs);
        }
      } catch (err) {
        console.error('Error fetching certifications:', err);
        setCertifications([]);
      } finally {
        setLoading(false);
      }
    };

    if (session && !permsLoading) {
      fetchCertifications();
    }
  }, [session, permsLoading, hasPermission, isSuperAdmin]);

  const handleLogout = () => {
    setSession(null);
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {}
    window.location.replace("/login");
    window.location.reload();
  };

  const navLinkStyle = (isActive, gradientColors) => {
    if (isActive) {
      return {
        background: `linear-gradient(to right, ${gradientColors.from}, ${gradientColors.to})`,
        color: '#ffffff',
        boxShadow: `0 10px 15px -3px ${gradientColors.shadow}`
      };
    }
    return {
      color: THEME_COLORS.lightBlue,
      backgroundColor: 'transparent'
    };
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 w-52 text-white shadow-2xl border-r transform transition-transform duration-300 z-30 flex flex-col justify-between ${
        open ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
      }`}
      style={{
        background: `linear-gradient(to bottom, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark}, ${THEME_COLORS.darkTeal})`,
        borderColor: THEME_COLORS.lightBlue
      }}
    >
      {/* Header */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b backdrop-blur-sm" style={{ borderColor: THEME_COLORS.lightBlue, backgroundColor: `${THEME_COLORS.darkTeal}cc` }}>
          <Link to="/" className="group">
            <Logo size="small" variant="with-subtitle" className="text-white" />
          </Link>
          <button
            aria-label="Close sidebar"
            className="md:hidden px-2 py-1 rounded-lg border transition-colors"
            style={{ borderColor: THEME_COLORS.lightBlue, color: '#ffffff' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.darkTealLight}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={onClose}
          >
            <span className="text-xs">✕</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {loading || permsLoading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Main Menu Items */}
              {visibleMainMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={({ isActive }) => {
                      return navLinkStyle(isActive, item.gradient);
                    }}
                    onMouseEnter={(e) => {
                      if (!location.pathname.startsWith(item.path)) {
                        e.currentTarget.style.backgroundColor = `${THEME_COLORS.darkTeal}80`;
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!location.pathname.startsWith(item.path)) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = THEME_COLORS.lightBlue;
                      }
                    }}
                    onClick={onClose}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}

              {/* Certifications Section */}
              {canAccess('certifications', 'retrieve') && (
                <>
                  {certifications.length > 0 && (
                    <div className="px-3 py-2 mt-3 mb-1">
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Certifications</div>
                    </div>
                  )}
                  {certifications.length === 0 && !loading && (
                    <div className="px-3 py-2 text-sm text-gray-400">No certifications found</div>
                  )}
                  {certifications.map((cert, index) => {
                    const certName = cert.name || cert.certification_type || `Certification ${index + 1}`;
                    const certPath = `/certifications?cert=${encodeURIComponent(cert.id)}`;
                    
                    // Generate gradient colors based on index for variety
                    const gradients = [
                      { from: THEME_COLORS.lightMint, to: THEME_COLORS.mediumTeal, shadow: `${THEME_COLORS.lightMint}50` },
                      { from: THEME_COLORS.mediumTeal, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.mediumTeal}50` },
                      { from: THEME_COLORS.darkTealLight, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.darkTeal}50` },
                      { from: THEME_COLORS.lightBlue, to: THEME_COLORS.mediumTeal, shadow: `${THEME_COLORS.lightBlue}50` },
                    ];
                    const gradient = gradients[index % gradients.length];

                    return (
                      <NavLink
                        key={cert.id || index}
                        to={certPath}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                        style={({ isActive }) => {
                          return navLinkStyle(isActive, gradient);
                        }}
                        onMouseEnter={(e) => {
                          if (!location.pathname.startsWith('/certifications') || !location.search.includes(`cert=${cert.id}`)) {
                            e.currentTarget.style.backgroundColor = `${THEME_COLORS.darkTeal}80`;
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!location.pathname.startsWith('/certifications') || !location.search.includes(`cert=${cert.id}`)) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = THEME_COLORS.lightBlue;
                          }
                        }}
                        onClick={onClose}
                      >
                        {React.createElement(MODULE_ICONS.certifications, { className: "h-4 w-4" })} 
                        <span>{certName}</span>
                      </NavLink>
                    );
                  })}
                </>
              )}
            </>
          )}
        </nav>
      </div>

      {/* 👇 Bottom Logout Section */}
      <div className="border-t px-3 py-4 backdrop-blur-sm" style={{ borderColor: THEME_COLORS.lightBlue, backgroundColor: `${THEME_COLORS.darkTeal}cc` }}>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all"
          style={{
            background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
            boxShadow: `0 10px 15px -3px ${THEME_COLORS.mediumTeal}50`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
            e.currentTarget.style.boxShadow = `0 10px 15px -3px ${THEME_COLORS.darkTeal}80`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
            e.currentTarget.style.boxShadow = `0 10px 15px -3px ${THEME_COLORS.mediumTeal}50`;
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
