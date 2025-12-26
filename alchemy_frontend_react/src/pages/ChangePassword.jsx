import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { post } from "../services/api";
import { THEME_COLORS } from "../constants/colors";

export default function ChangePassword() {
  const { session, restored } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
  });

  // Redirect if not logged in - check storage directly (not session context)
  // This allows the page to work even if session context hasn't updated yet
  useEffect(() => {
    if (!restored) return;
    
    const token = sessionStorage.getItem("auth_token");
    const userStr = localStorage.getItem("user");
    
    // Only redirect if storage is missing (ProtectedRoute will also check this)
    if (!token || !userStr) {
      navigate("/login", { replace: true });
    }
  }, [restored, navigate]);

  // Add/remove body class for root scaling override
  useEffect(() => {
    document.body.classList.add('auth-page-active');
    return () => {
      document.body.classList.remove('auth-page-active');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Input validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Please fill in all fields", "error");
      return;
    }

    // Validate password strength
    const hasLength = newPassword.length >= 12;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(newPassword);

    if (!hasLength || !hasUpper || !hasNumber || !hasSpecial) {
      const errors = [];
      if (!hasLength) errors.push("at least 12 characters");
      if (!hasUpper) errors.push("1 uppercase letter");
      if (!hasNumber) errors.push("1 number");
      if (!hasSpecial) errors.push("1 special character");
      showToast(`Password must contain: ${errors.join(", ")}`, "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New password and confirm password do not match", "error");
      return;
    }

    if (currentPassword === newPassword) {
      showToast("New password must be different from current password", "error");
      return;
    }

    try {
      setLoading(true);
      const response = await post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (response.error) {
        showToast(response.error || "Failed to change password", "error");
        return;
      }

      // Store flag that password has been changed
      localStorage.setItem("password_changed", "true");
      
      showToast("Password changed successfully!", "success");
      // Redirect to home after successful password change
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
    } catch (error) {
      let errorMessage = "Failed to change password. Please try again.";
      if (error.body?.detail) {
        errorMessage = error.body.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (!restored) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 p-3 p-md-4" style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.offWhite}, ${THEME_COLORS.lightBlue})`, height: '100vh', maxHeight: '100vh', overflowY: 'auto', overflowX: 'hidden' }} data-auth-page>
      <div className="w-100" style={{ maxWidth: '90rem' }}>
        <div className="bg-white rounded shadow-lg border border-gray-200 p-4 p-md-5">
          <div className="text-center mb-4 mb-md-5">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle shadow-lg mb-3" style={{ width: '4rem', height: '4rem', background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}>
              <Lock className="text-white" style={{ width: '2rem', height: '2rem' }} />
            </div>
            <h2 className="h3 fw-bold text-gray-900 mb-2">Change Password</h2>
            <p className="text-muted mb-0">Please set a new password for your account</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Horizontal Form Fields */}
            <div className="row g-3 mb-4">
              {/* Current Password */}
              <div className="col-12 col-md-4">
                <label htmlFor="currentPassword" className="form-label small fw-medium text-gray-700">
                  Current Password
                </label>
                <div className="position-relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-control pe-5"
                    style={{ 
                      borderColor: '#d1d5db',
                      padding: '0.75rem 1rem'
                    }}
                    placeholder="Enter current password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-2"
                    style={{ border: 'none', background: 'transparent' }}
                    disabled={loading}
                  >
                    {showCurrentPassword ? <EyeOff style={{ width: '1.25rem', height: '1.25rem' }} /> : <Eye style={{ width: '1.25rem', height: '1.25rem' }} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="col-12 col-md-4">
                <label htmlFor="newPassword" className="form-label small fw-medium text-gray-700">
                  New Password
                </label>
                <div className="position-relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      const pwd = e.target.value;
                      setNewPassword(pwd);
                      // Update password validation state
                      setPasswordErrors({
                        length: pwd.length >= 12,
                        uppercase: /[A-Z]/.test(pwd),
                        number: /[0-9]/.test(pwd),
                        special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pwd),
                      });
                    }}
                    className="form-control pe-5"
                    style={{ 
                      borderColor: '#d1d5db',
                      padding: '0.75rem 1rem'
                    }}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-2"
                    style={{ border: 'none', background: 'transparent' }}
                    disabled={loading}
                  >
                    {showNewPassword ? <EyeOff style={{ width: '1.25rem', height: '1.25rem' }} /> : <Eye style={{ width: '1.25rem', height: '1.25rem' }} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="col-12 col-md-4">
                <label htmlFor="confirmPassword" className="form-label small fw-medium text-gray-700">
                  Confirm New Password
                </label>
                <div className="position-relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-control pe-5"
                    style={{ 
                      borderColor: '#d1d5db',
                      padding: '0.75rem 1rem'
                    }}
                    placeholder="Confirm new password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-2"
                    style={{ border: 'none', background: 'transparent' }}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff style={{ width: '1.25rem', height: '1.25rem' }} /> : <Eye style={{ width: '1.25rem', height: '1.25rem' }} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="mb-4 p-3 bg-light rounded border border-gray-200">
              <p className="small fw-semibold text-gray-700 mb-2">Password Requirements:</p>
              <div className="row g-2">
                <div className="col-6 col-md-3">
                  <div className={`d-flex align-items-center gap-2 small ${passwordErrors.length ? 'text-success' : 'text-muted'}`}>
                    <span>{passwordErrors.length ? '✓' : '○'}</span>
                    <span>At least 12 characters</span>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className={`d-flex align-items-center gap-2 small ${passwordErrors.uppercase ? 'text-success' : 'text-muted'}`}>
                    <span>{passwordErrors.uppercase ? '✓' : '○'}</span>
                    <span>1 uppercase letter (A-Z)</span>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className={`d-flex align-items-center gap-2 small ${passwordErrors.number ? 'text-success' : 'text-muted'}`}>
                    <span>{passwordErrors.number ? '✓' : '○'}</span>
                    <span>1 number (0-9)</span>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className={`d-flex align-items-center gap-2 small ${passwordErrors.special ? 'text-success' : 'text-muted'}`}>
                    <span>{passwordErrors.special ? '✓' : '○'}</span>
                    <span>1 special character</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="d-flex justify-content-center">
              <button
                type="submit"
                disabled={loading}
                className="btn text-white fw-semibold py-2 px-5 rounded shadow-sm"
                style={{ 
                  background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                  transition: 'all 0.2s ease',
                  minWidth: '200px'
                }}
              >
                {loading ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Changing Password...
                  </span>
                ) : (
                  "Change Password"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

