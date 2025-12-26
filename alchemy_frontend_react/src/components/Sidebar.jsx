import React, { useState } from "react";
import { ChevronLeft, ChevronRight, UserCog, LogOut } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { usePermissions } from "../hooks/usePermissions";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { THEME_COLORS } from "../constants/colors";
import Logo from "./Logo";

export default function Sidebar({ open, onClose, collapsed, onCollapseToggle }) {
  const location = useLocation();
  const { session, setSession, tenantId } = useSession();
  const { hasPermission, loading: permsLoading, userRoles } = usePermissions(tenantId);

  // Check if user is superadmin
  const isSuperAdmin = userRoles.some(
    (userRole) => userRole?.roles?.role_name?.toLowerCase() === 'super admin'
  );

  // Helper function to check if user has permission or is superadmin
  const canAccess = (module, action) => {
    return isSuperAdmin || hasPermission(module, action);
  };

  // Check if user can access dashboard (has access to at least one underlying module)
  const canAccessDashboard = () => {
    if (isSuperAdmin) return true;
    // Dashboard is accessible if user can view tasks, controls, or certifications
    return (
      hasPermission('tasks', 'retrieve') ||
      hasPermission('security_controls', 'retrieve') ||
      hasPermission('certifications', 'retrieve')
    );
  };

  // Regular menu items
  const regularMenuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: MODULE_ICONS.dashboard,
      module: "dashboard",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.mediumTeal, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.mediumTeal}50` },
      customAccessCheck: canAccessDashboard
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
      name: "Audits",
      path: "/audits",
      icon: MODULE_ICONS.tasks,
      module: "audits",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.lightMint, to: THEME_COLORS.mediumTeal, shadow: `${THEME_COLORS.lightMint}50` }
    },
    {
      name: "Controls",
      path: "/security-controls",
      icon: MODULE_ICONS.security_controls,
      module: "security_controls",
      permission: "retrieve",
      gradient: { from: THEME_COLORS.mediumTeal, to: THEME_COLORS.darkTeal, shadow: `${THEME_COLORS.mediumTeal}50` }
    },
  ];

  // Admin menu items
  const adminMenuItems = [
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

  // Filter regular menu items based on permissions (superadmin sees all)
  const visibleRegularMenuItems = regularMenuItems.filter(item => {
    if (isSuperAdmin) return true;
    // Use custom access check if provided, otherwise use default permission check
    if (item.customAccessCheck) {
      return item.customAccessCheck();
    }
    return canAccess(item.module, item.permission);
  });

  // Filter admin menu items based on permissions (superadmin sees all)
  const visibleAdminMenuItems = adminMenuItems.filter(item => {
    if (isSuperAdmin) return true;
    return canAccess(item.module, item.permission);
  });

  // Check if admin section should be visible (only if there are actual admin menu items)
  const hasAdminAccess = visibleAdminMenuItems.length > 0;

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
        background: `linear-gradient(to right, ${THEME_COLORS.cyan}dd, ${THEME_COLORS.deepBlue}dd)`,
        color: '#ffffff',
        boxShadow: `0 4px 8px -2px ${THEME_COLORS.cyan}30`
      };
    }
    return {
      color: THEME_COLORS.copper,
      backgroundColor: 'transparent'
    };
  };

  const sidebarStyle = {
    width: '208px',
    backgroundColor: '#FFFFFF',
    background: `linear-gradient(to bottom, #FFFFFF, #F8F9FA, #FFFFFF)`,
    borderColor: THEME_COLORS.cyan + '30',
    zIndex: 1030,
    transition: 'transform 0.3s ease-in-out',
    transform: open ? 'translateX(0)' : 'translateX(-100%)'
  };

  // On desktop, always show sidebar
  if (window.innerWidth >= 768) {
    sidebarStyle.transform = 'translateX(0)';
  }

  return (
    <aside
      className="position-fixed top-0 start-0 h-100 shadow-lg border-end d-flex flex-column bg-white"
      style={sidebarStyle}
    >
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="d-flex align-items-center justify-content-between px-3 px-md-4 py-3 border-bottom" style={{ borderColor: THEME_COLORS.cyan + '30', backgroundColor: '#FFFFFF' }}>
          <Link to="/" className="text-decoration-none">
            <Logo size="small" variant="with-subtitle" className="text-copper" />
          </Link>
          <button
            type="button"
            aria-label="Close sidebar"
            className="btn btn-link d-md-none p-1"
            style={{ borderColor: THEME_COLORS.cyan + '40', color: THEME_COLORS.copper }}
            onClick={onClose}
          >
            <span>✕</span>
          </button>
        </div>
      </div>

      {/* Navigation - Takes up available space */}
      <div className="flex-fill overflow-auto">
        <nav className="px-2 px-md-3 py-3 py-md-4 space-y-1">
          {permsLoading ? (
            <div className="px-3 py-2 text-sm" style={{ color: THEME_COLORS.copper + '80' }}>Loading...</div>
          ) : (
            <>
              {/* Regular Menu Items */}
              {visibleRegularMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="d-flex align-items-center gap-2 px-2 px-md-3 py-2 rounded text-decoration-none small fw-medium"
                    style={({ isActive }) => {
                      return navLinkStyle(isActive, item.gradient);
                    }}
                    onMouseEnter={(e) => {
                      if (!location.pathname.startsWith(item.path)) {
                        e.currentTarget.style.backgroundColor = '#F0F4F6';
                        e.currentTarget.style.color = THEME_COLORS.deepBlue;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!location.pathname.startsWith(item.path)) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = THEME_COLORS.copper;
                      }
                    }}
                    onClick={onClose}
                  >
                    <Icon size={16} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}

              {/* Admin Section */}
              {hasAdminAccess && (
                <>
                  <div className="px-2 px-md-3 py-2 mt-3 mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <UserCog size={14} style={{ color: THEME_COLORS.copper + '80' }} />
                      <div className="text-xs uppercase tracking-wider" style={{ color: THEME_COLORS.copper + '80' }}>Admin</div>
                    </div>
                  </div>

                  {/* Admin Menu Items */}
                  {visibleAdminMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className="d-flex align-items-center gap-2 px-2 px-md-3 py-2 rounded text-decoration-none small fw-medium"
                        style={({ isActive }) => {
                          const baseStyle = navLinkStyle(isActive, item.gradient);
                          return {
                            ...baseStyle,
                            paddingLeft: '1.5rem', // Indent children under Admin
                          };
                        }}
                        onMouseEnter={(e) => {
                          if (!location.pathname.startsWith(item.path)) {
                            e.currentTarget.style.backgroundColor = '#F0F4F6';
                            e.currentTarget.style.color = THEME_COLORS.deepBlue;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!location.pathname.startsWith(item.path)) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = THEME_COLORS.copper;
                          }
                        }}
                        onClick={onClose}
                      >
                        <Icon size={16} />
                        <span>{item.name}</span>
                      </NavLink>
                    );
                  })}
                </>
              )}

            </>
          )}
        </nav>
      </div>

      {/* 👇 Bottom Logout Section - Sticks to bottom */}
      <div className="flex-shrink-0 border-t px-3 py-4 backdrop-blur-sm" style={{ borderColor: THEME_COLORS.cyan + '30', backgroundColor: '#FFFFFF' }}>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all"
          style={{
            background: `linear-gradient(to right, ${THEME_COLORS.cyan}, ${THEME_COLORS.deepBlue})`,
            boxShadow: `0 4px 8px -2px ${THEME_COLORS.cyan}30`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.deepBlue}, ${THEME_COLORS.deepBlueDark})`;
            e.currentTarget.style.boxShadow = `0 6px 10px -2px ${THEME_COLORS.deepBlue}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.cyan}, ${THEME_COLORS.deepBlue})`;
            e.currentTarget.style.boxShadow = `0 4px 8px -2px ${THEME_COLORS.cyan}30`;
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
