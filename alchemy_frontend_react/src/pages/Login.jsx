import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, CheckCircle2, Globe, Code2 } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { post } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Logo from "../components/Logo";
import { signInWithMicrosoft, initializeMSAL, isSSOConfigured } from "../services/ssoService";

export default function Login() {
  const { session, setSession, restored } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  // CRITICAL: If session exists, immediately redirect to home
  // This prevents logged-in users from accessing login page
  useEffect(() => {
    if (!restored) return; // Wait for session restoration
    
    // Check if session exists in storage
    const token = sessionStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    // If valid session exists, redirect to home
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id) {
          // Valid session - redirect to home
          navigate('/', { replace: true });
          return;
        }
      } catch (e) {
        // Invalid user data - clear it
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
    
    // Also check if session context has valid session
    if (session && session.user && session.user.id) {
      navigate('/', { replace: true });
    }
  }, [session, restored, navigate]);

  // Initialize MSAL on component mount
  useEffect(() => {
    initializeMSAL();
  }, []);

  // Animation cycle for left side
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Add/remove body class for root scaling override
  useEffect(() => {
    document.body.classList.add('auth-page-active');
    return () => {
      document.body.classList.remove('auth-page-active');
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showToast("Please enter both email and password", "error");
      return;
    }

    try {
      setLoading(true);
      const response = await post("/api/auth/login", { email, password });
      
      if (response.error) {
        showToast(response.error || "Login failed", "error");
        return;
      }

      const { token, user, requires_password_change } = response.data;
      
      // Validate response data
      if (!token || !user) {
        showToast("Invalid response from server", "error");
        return;
      }
      
      // Store token and user info FIRST (before session context update)
      sessionStorage.setItem("auth_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Update session context
      setSession({
        token,
        user,
        user_id: user.id,
        tenant_id: user.tenant_id,
      });
      
      // Check if password change is required
      // Use a small delay to ensure session context updates before navigation
      if (requires_password_change === true) {
        showToast("Please change your password to continue", "info");
        // Small delay to ensure session context is updated
        setTimeout(() => {
          navigate("/change-password", { replace: true });
        }, 50);
      } else {
        showToast("Login successful!", "success");
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 50);
      }
    } catch (error) {
      // Handle specific error messages from backend (e.g., inactive user)
      let errorMessage = "Login failed. Please check your credentials.";
      
      if (error.body) {
        if (typeof error.body === 'string') {
          errorMessage = error.body;
        } else if (error.body.detail) {
          errorMessage = error.body.detail;
        } else if (error.body.error) {
          errorMessage = typeof error.body.error === 'string' ? error.body.error : error.body.error.message || error.body.error.detail || errorMessage;
        } else if (error.body.message) {
          errorMessage = error.body.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error("Login error:", error);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async () => {
    try {
      setSsoLoading(true);
      
      // Get Microsoft access token
      const accessToken = await signInWithMicrosoft();
      
      if (!accessToken) {
        showToast("Failed to get Microsoft access token", "error");
        return;
      }
      
      // Send token to backend for validation and user creation
      const response = await post("/api/auth/sso/login", { access_token: accessToken });
      
      if (response.error) {
        showToast(response.error || "SSO login failed", "error");
        return;
      }

      const { token, user } = response.data;
      
      // Store token and user info
      sessionStorage.setItem("auth_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Update session context
      setSession({
        token,
        user,
        user_id: user.id,
        tenant_id: user.tenant_id,
      });
      
      showToast("SSO login successful!", "success");
      navigate("/");
    } catch (error) {
      // Handle specific error messages
      let errorMessage = "SSO login failed. Please try again.";
      
      if (error.code === 'SSO_NOT_CONFIGURED') {
        errorMessage = "Microsoft SSO is not configured. Please contact your administrator.";
      } else if (error.message && error.message.includes('Client ID')) {
        errorMessage = error.message;
      } else if (error.body?.detail) {
        errorMessage = error.body.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, "error");
    } finally {
      setSsoLoading(false);
    }
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Cybersecurity Portal",
      description: "Advanced security controls and threat management",
      gradient: `linear-gradient(to bottom right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
    },
    {
      icon: CheckCircle2,
      title: "Unified Compliance",
      description: "Streamlined compliance and QA management",
      gradient: `linear-gradient(to bottom right, ${THEME_COLORS.lightMint}, ${THEME_COLORS.mediumTeal})`,
    },
    {
      icon: Code2,
      title: "Modern Platform",
      description: "Built with cutting-edge technology",
      gradient: `linear-gradient(to bottom right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.mediumTeal})`,
    },
  ];

  return (
    <div className="d-flex vh-100" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', width: '100vw', position: 'fixed', top: 0, left: 0 }} data-auth-page>
      {/* Left Side - Branding & Animation */}
      <div className="d-none d-lg-flex col-lg-6 position-relative" style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTealDark})`, height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Animated Background Pattern */}
        <div className="position-absolute top-0 start-0 w-100 h-100 opacity-10">
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Floating Shapes */}
        <div className="position-absolute" style={{ top: '5rem', left: '5rem', width: '8rem', height: '8rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)', animation: 'pulse 3s ease-in-out infinite' }}></div>
        <div className="position-absolute" style={{ bottom: '5rem', right: '5rem', width: '10rem', height: '10rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)', animation: 'pulse 3s ease-in-out infinite', animationDelay: '1s' }}></div>
        <div className="position-absolute" style={{ top: '50%', left: '25%', width: '6rem', height: '6rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)', animation: 'pulse 3s ease-in-out infinite', animationDelay: '2s' }}></div>

        {/* Content */}
        <div className="position-relative z-1 d-flex flex-column justify-content-center align-items-center px-3 px-lg-4 py-4 text-white" style={{ height: '100%', overflow: 'hidden' }}>
          {/* Logo */}
          <div className="mb-3 d-flex flex-column align-items-center">
            <div className="mb-3">
              <Logo size="xxl" showText={false} className="justify-content-center" />
            </div>
            <div className="d-flex align-items-baseline gap-2 mb-1">
              <h1 className="display-5 fw-bold text-white mb-0">Alchemy</h1>
              <span className="fs-2 fw-bolder text-white px-2 py-1 rounded shadow-lg" style={{ 
                background: `linear-gradient(135deg, #10b981, #059669)`,
                boxShadow: `0 4px 12px rgba(16, 185, 129, 0.5)`
              }}>
                QA
              </span>
            </div>
            <p className="fs-6 text-white opacity-90 text-center mb-1">Unified Compliance & QA Portal</p>
            <p className="small text-white opacity-80 text-center mb-0">Cybersecurity Portal</p>
          </div>

          {/* Animated Features */}
          <div className="mt-3 w-100" style={{ maxWidth: '26rem' }}>
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = animationStep === index;
              return (
                <div
                  key={index}
                  className={`d-flex align-items-center gap-2 p-2 rounded mb-2 border border-white border-opacity-20 transition-all ${isActive ? "bg-white bg-opacity-20 shadow-lg" : "bg-white bg-opacity-10 opacity-75"}`}
                  style={{ 
                    backdropFilter: 'blur(12px)',
                    transition: 'all 0.5s ease',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  <div className="p-2 rounded shadow" style={{ background: feature.gradient, flexShrink: 0 }}>
                    <Icon className="text-white" style={{ width: '1.25rem', height: '1.25rem' }} />
                  </div>
                  <div className="flex-grow-1">
                    <h3 className="fw-semibold small mb-0">{feature.title}</h3>
                    <p className="small text-white opacity-80 mb-0" style={{ fontSize: '0.7rem' }}>{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Code-like decoration */}
          <div className="mt-3 font-monospace" style={{ fontSize: '0.7rem' }}>
            <div className="d-flex gap-2">
              {/* <span className="text-white opacity-40">{'<'}</span> */}
              {/* <span>Alchemy QA</span> */}
              {/* <span className="text-white opacity-40">{'/>'}</span> */}
            </div>
            <div className="d-flex gap-2 ms-3">
              {/* <span className="text-white opacity-40">type:</span> */}
              {/* <span>"unified-platform"</span> */}
            </div>
            <div className="d-flex gap-2 ms-3">
              {/* <span className="text-white opacity-40">security:</span> */}
              {/* <span>"enterprise-grade"</span> */}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center p-3" style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.offWhite}, ${THEME_COLORS.lightBlue})`, height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        <div className="w-100" style={{ maxWidth: '28rem', maxHeight: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Mobile Logo */}
          <div className="d-lg-none d-flex justify-content-center mb-3">
              <Logo size="default" variant="with-subtitle" />
          </div>

          {/* Login Card */}
          <div className="bg-white rounded shadow-lg border border-gray-200 p-4">
            <div className="text-center mb-4 mb-md-5">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle shadow-lg mb-3" style={{ width: '4rem', height: '4rem', background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}>
                <Lock className="text-white" style={{ width: '2rem', height: '2rem' }} />
              </div>
              <h2 className="h3 fw-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-muted mb-0">Sign in to access your account</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label small fw-medium text-gray-700">
                  Username / Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  style={{ 
                    borderColor: '#d1d5db',
                    padding: '0.75rem 1rem'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label small fw-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-control"
                  style={{ 
                    borderColor: '#d1d5db',
                    padding: '0.75rem 1rem'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || ssoLoading}
                className="btn w-100 text-white fw-semibold py-2 rounded shadow-sm"
                style={{ 
                  background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => !loading && !ssoLoading && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`)}
                onMouseLeave={(e) => !loading && !ssoLoading && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`)}
              >
                {loading ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Request Access Button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  const recipient = "praveen.a@cavininfotech.com";
                  const cc = "saran.s@hepl.com";
                  const subject = "Request access to Alchemy";
                  // Use Outlook Web deeplink - try with both cc and ccRecipients parameters
                  // Some Outlook versions require different parameter names
                  const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipient)}&cc=${encodeURIComponent(cc)}&ccRecipients=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}`;
                  window.open(outlookWebUrl, "_blank");
                }}
                className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2"
              >
                <svg style={{ width: '1.25rem', height: '1.25rem' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Request Access
              </button>
            </div>

            {/* Divider */}
            <div className="position-relative my-4">
              <div className="position-absolute top-50 start-0 w-100" style={{ borderTop: '1px solid #d1d5db' }}></div>
              <div className="position-relative d-flex justify-content-center">
                <span className="px-2 bg-white text-muted small">Or continue with</span>
              </div>
            </div>

            {/* Microsoft SSO Button */}
            <button
              type="button"
              onClick={handleSSOLogin}
              disabled={loading || ssoLoading || !isSSOConfigured()}
              className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2"
              title={!isSSOConfigured() ? "Microsoft SSO is not configured. Please set VITE_MS_CLIENT_ID and VITE_MS_TENANT_ID environment variables." : ""}
            >
              {ssoLoading ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Signing in with Microsoft...
                </span>
              ) : (
                <>
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
                    <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
                    <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
                    <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
                  </svg>
                  Sign in with Microsoft
                </>
              )}
            </button>

            {/* Footer */}
            <div className="mt-4">
              <p className="small text-muted text-center mb-0">
                © {new Date().getFullYear()} Alchemy QA — Secure Access Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
