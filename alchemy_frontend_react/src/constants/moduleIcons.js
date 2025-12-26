/**
 * Module Icon Constants
 * Centralized icon mapping for all modules to ensure consistency across the application
 */
import {
  Bug,
  CheckSquare,
  Users,
  ShieldCheck,
  UserCog,
  Package,
  Shield,
  Award,
  LayoutDashboard,
} from "lucide-react";

export const MODULE_ICONS = {
  bugs: Bug,
  tasks: CheckSquare,
  users: Users,
  security_controls: ShieldCheck,
  roles: UserCog,
  builds: Package,
  cybersecurity: Shield,
  certifications: Award,
  dashboard: LayoutDashboard,
};

/**
 * Get icon component for a module
 * @param {string} moduleName - Module name (e.g., 'bugs', 'tasks', 'users')
 * @returns {React.Component} Icon component
 */
export function getModuleIcon(moduleName) {
  const normalizedName = moduleName.toLowerCase().replace(/[-\s]/g, "_");
  return MODULE_ICONS[normalizedName] || ShieldCheck; // Default to ShieldCheck if not found
}

