import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Shield, CheckSquare, TrendingUp } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { THEME_COLORS } from "../constants/colors";
import { useSession } from "../contexts/SessionContext";
import { get } from "../services/api";

const COLORS = {
  primary: THEME_COLORS.darkTeal,
  secondary: THEME_COLORS.mediumTeal,
  accent: THEME_COLORS.lightBlue,
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

export default function Home() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  // Dashboard metrics state
  const [taskMetrics, setTaskMetrics] = useState({ total: 0 });
  const [controlsMetrics, setControlsMetrics] = useState({
    total_controls: 0,
    compliance_rate: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch combined dashboard metrics (tasks + controls) in one call
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!session || sessionLoading) return;
      try {
        setMetricsLoading(true);
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(
          `/api/dashboard/metrics?tenant_id=${encodeURIComponent(tenant_id)}`
        );
        if (json.error) {
          const errorMsg = typeof json.error === 'string' 
            ? json.error 
            : json.error?.message || json.error?.detail || JSON.stringify(json.error);
          throw new Error(errorMsg);
        }
        const data = json.data || {};
        // Set task metrics
        setTaskMetrics(data.tasks || { total: 0 });
        // Set controls metrics
        setControlsMetrics(data.controls || { 
          total_controls: 0, 
          compliance_rate: 0
        });
      } catch (err) {
        // Silently fail for welcome page - don't show error toast
        setTaskMetrics({ total: 0 });
        setControlsMetrics({ 
          total_controls: 0, 
          compliance_rate: 0
        });
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, [session, sessionLoading]);

  const quickLinks = [
    {
      icon: MODULE_ICONS.security_controls,
      title: "Security Controls",
      description: "Manage and monitor security controls",
      path: "/security-controls",
      gradient: `linear-gradient(to bottom right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
    },
    {
      icon: MODULE_ICONS.tasks,
      title: "Tasks",
      description: "Track and manage compliance tasks",
      path: "/tasks",
      gradient: `linear-gradient(to bottom right, ${THEME_COLORS.lightMint}, ${THEME_COLORS.mediumTeal})`,
    },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen" style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.offWhite}, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.offWhite})` }}>
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, ${THEME_COLORS.mediumTeal} 1px, transparent 0)`,
              backgroundSize: '60px 60px'
            }}></div>
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: `${THEME_COLORS.lightMint}33` }}></div>
          <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full blur-3xl animate-pulse delay-1000" style={{ backgroundColor: `${THEME_COLORS.lightBlue}33` }}></div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
            {/* Welcome Message - Smaller */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 animate-fade-in-up">
                Welcome to <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}>Alchemy QA</span>
              </h1>
              
              <p className="text-base sm:text-lg text-gray-600 max-w-4xl mx-auto animate-fade-in-up delay-100">
                Your unified platform for compliance management, security controls, quality control.
              </p>
            </div>

            {/* Dashboard Cards */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              <div
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl border transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                style={{
                  borderLeft: `4px solid ${COLORS.secondary}`,
                  borderColor: THEME_COLORS.lightBlue,
                }}
                onClick={() => navigate("/security-controls")}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.secondary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = THEME_COLORS.lightBlue}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Total Controls</p>
                    <h3 className="text-2xl font-bold" style={{ color: COLORS.secondary }}>
                      {metricsLoading ? "..." : controlsMetrics.total_controls}
                    </h3>
                  </div>
                  <Shield size={32} color={COLORS.secondary} />
                </div>
              </div>

              <div
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl border transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                style={{
                  borderLeft: `4px solid ${COLORS.primary}`,
                  borderColor: THEME_COLORS.lightBlue,
                }}
                onClick={() => navigate("/tasks")}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = THEME_COLORS.lightBlue}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Total Tasks</p>
                    <h3 className="text-2xl font-bold" style={{ color: COLORS.primary }}>
                      {metricsLoading ? "..." : taskMetrics.total}
                    </h3>
                  </div>
                  <CheckSquare size={32} color={COLORS.primary} />
                </div>
              </div>

              <div
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl border transition-all duration-300 transform hover:-translate-y-1"
                style={{
                  borderLeft: `4px solid ${COLORS.success}`,
                  borderColor: THEME_COLORS.lightBlue,
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.success}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = THEME_COLORS.lightBlue}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Compliance Score</p>
                    <h3 className="text-2xl font-bold" style={{ color: COLORS.success }}>
                      {metricsLoading ? "..." : `${controlsMetrics.compliance_rate}%`}
                    </h3>
                  </div>
                  <TrendingUp size={32} color={COLORS.success} />
                </div>
              </div>
            </div>

            
            {/* Features Section - Moved to top, smaller */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {/* Compliance Management */}
              <div className="text-center">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
                  style={{ backgroundColor: `${THEME_COLORS.lightMint}40` }}
                >
                  <CheckCircle2
                    className="w-6 h-6"
                    style={{ color: THEME_COLORS.darkTeal }}
                  />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Compliance Management
                </h3>
                <p className="text-gray-600 text-xs">
                  Track and manage compliance requirements with comprehensive tools and reporting.
                </p>
              </div>

              {/* Security Controls */}
              <div className="text-center">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
                  style={{ backgroundColor: `${THEME_COLORS.lightBlue}40` }}
                >
                  {React.createElement(MODULE_ICONS.security_controls, {
                    className: "w-6 h-6",
                    style: { color: THEME_COLORS.darkTeal },
                  })}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Security Controls
                </h3>
                <p className="text-gray-600 text-xs">
                  Monitor and maintain security controls with real-time visibility and alerts.
                </p>
              </div>

              {/* Task Tracking */}
              <div className="text-center">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
                  style={{ backgroundColor: `${THEME_COLORS.lightMint}40` }}
                >
                  {React.createElement(MODULE_ICONS.tasks, {
                    className: "w-6 h-6",
                    style: { color: THEME_COLORS.darkTeal },
                  })}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Task Tracking
                </h3>
                <p className="text-gray-600 text-xs">
                  Organize and track compliance tasks with detailed workflows and assignments.
                </p>
              </div>
            </div>

            {/* Quick Links Grid - Starting from third row */}
            <div className="flex justify-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
                {quickLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => navigate(link.path)}
                      className="group relative bg-white rounded-xl p-6 shadow-md hover:shadow-xl border transition-all duration-300 transform hover:-translate-y-1 text-left"
                      style={{ borderColor: THEME_COLORS.lightBlue }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = THEME_COLORS.lightBlue}
                    >
                      {/* Gradient Background on Hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300" style={{ background: link.gradient }}></div>
                      
                      {/* Icon */}
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 shadow-md group-hover:scale-110 transition-transform duration-300" style={{ background: link.gradient }}>
                        <Icon className="w-6 h-6 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }} />
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-lg font-semibold mb-2 transition-colors" style={{ color: '#1f2937' }} onMouseEnter={(e) => e.currentTarget.style.color = THEME_COLORS.darkTeal} onMouseLeave={(e) => e.currentTarget.style.color = '#1f2937'}>
                        {link.title}
                      </h3>
                      <p className="text-sm mb-4" style={{ color: '#4b5563' }}>
                        {link.description}
                      </p>
                      
                      {/* Arrow */}
                      <div className="flex items-center font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: THEME_COLORS.darkTeal }}>
                        Go to {link.title}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
