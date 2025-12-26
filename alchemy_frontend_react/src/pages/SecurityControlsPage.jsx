import React, { useEffect, useState, useMemo, useRef } from "react";
// Data is fetched via FastAPI; Supabase is used only for auth in hooks
import DataTable from "react-data-table-component";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { useSession } from "../contexts/SessionContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { useSecurityControls, useCertifications, useInvalidateSecurityControls } from "../hooks/useSecurityControls";
import { get, del } from "../services/api";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { Search, Plus, Eye, FileEdit, Trash, X } from "lucide-react";
import { THEME_COLORS } from "../constants/colors";
import Loader from "../components/Loader";
import ModernModal from "../components/ModernModal";
import SecurityControlEditModal from "../components/SecurityControlEditModal";
import SecurityControlViewModal from "../components/SecurityControlViewModal";
import SecurityControlCreateModal from "../components/SecurityControlCreateModal";

// Certification Searchable Dropdown Component - Proper Select with Search
function CertificationSearchableDropdown({ value, onChange, options = [], placeholder = "Select certification..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter options based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(options);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredOptions(
        options.filter((opt) => opt.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, options]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  const handleSelectOption = (option) => {
    if (onChange) {
      onChange(option);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange("");
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt === value) || value;

  return (
    <div style={{ position: "relative", maxWidth: "400px" }} ref={dropdownRef}>
      {/* Select Button */}
      <div
        onClick={handleToggle}
        style={{
          width: "100%",
          padding: "0.5rem 0.75rem",
          paddingRight: value ? "2.5rem" : "2.5rem",
          border: `1px solid ${THEME_COLORS.lightBlue}`,
          borderRadius: "0.5rem",
          height: "38px",
          boxSizing: "border-box",
          background: "#ffffff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative"
        }}
      >
        <span style={{ 
          color: value ? "#374151" : "#9ca3af",
          fontSize: "0.875rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          textAlign: "left"
        }}>
          {value ? selectedOption : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {value && (
            <button
              onClick={handleClear}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#374151"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
              title="Clear selection"
            >
              <X size={16} />
            </button>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              flexShrink: 0
            }}
          >
            <path
              d="M6 9L1 4h10z"
              fill="#6b7280"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            background: "#ffffff",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            overflow: "hidden"
          }}
        >
          {/* Search Input */}
          <div style={{ position: "relative", padding: "0.5rem", borderBottom: "1px solid #e5e7eb" }}>
            <Search
              size={16}
              style={{ 
                position: "absolute",
                left: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#6b7280"
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search certifications..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.5rem",
                border: `1px solid ${THEME_COLORS.lightBlue}`,
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                boxSizing: "border-box"
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div style={{ maxHeight: "250px", overflowY: "auto" }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  onClick={() => handleSelectOption(option)}
                  style={{
                    padding: "0.75rem 1rem",
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background-color 0.15s",
                    backgroundColor: value === option ? "#f0f9ff" : "#ffffff",
                    color: value === option ? THEME_COLORS.darkTeal : "#374151",
                    fontWeight: value === option ? "500" : "400"
                  }}
                  onMouseEnter={(e) => {
                    if (value !== option) {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value !== option) {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }
                  }}
                >
                  {option}
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "0.875rem"
                }}
              >
                {searchQuery ? "No certifications found" : "No certifications available"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Use relative '/api' so dev proxy routes to FastAPI and prod rewrites work

export default function SecurityControlsPage() {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterCertification, setFilterCertification] = useState("");
  const [selectedCertification, setSelectedCertification] = useState(""); // For DB filtering
  const [activeTab] = useState("table");
  const [perPage, setPerPage] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('securityControlsPerPage');
    return saved ? Number(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingControlId, setEditingControlId] = useState(null);
  const [viewingControlId, setViewingControlId] = useState(null);
  const [creatingControl, setCreatingControl] = useState(false);
  
  // Use React Query hooks for data fetching - pass selected certification for DB filtering
  // Normalize certification value
  const certValue = selectedCertification ? String(selectedCertification).trim() : '';
  const { data: controlsData = [], isLoading: controlsLoading, error: controlsError } = useSecurityControls(certValue);
  const { data: certifications = [], isLoading: certificationsLoading } = useCertifications();
  const invalidateSecurityControls = useInvalidateSecurityControls();
  
  // Process controls - certifications come directly from security_controls table
  const controls = useMemo(() => {
    if (!controlsData.length) return [];
    
    // Controls already have certification from the database
    // No need to process or override - use certification directly from control
    return controlsData.map((control) => ({
      ...control,
      certification: control.certification || ""
    }));
  }, [controlsData]);
  
  // Read filters from URL query parameters
  useEffect(() => {
    const certParam = searchParams.get("certification");
    if (certParam) {
      setFilterCertification(decodeURIComponent(certParam));
    }
    const controlIdParam = searchParams.get("control_id");
    if (controlIdParam) {
      // Set search text to filter by control ID
      setSearchText(decodeURIComponent(controlIdParam));
    }
    // Read other filter parameters from URL
    const priorityParam = searchParams.get("priority");
    if (priorityParam) {
      setFilterPriority(decodeURIComponent(priorityParam));
    }
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setFilterStatus(decodeURIComponent(statusParam));
    }
    const domainParam = searchParams.get("domain");
    if (domainParam) {
      setFilterDomain(decodeURIComponent(domainParam));
    }
    const assigneeParam = searchParams.get("assignee");
    if (assigneeParam) {
      setFilterAssignee(decodeURIComponent(assigneeParam));
    }
    const departmentParam = searchParams.get("department");
    if (departmentParam) {
      setFilterDepartment(decodeURIComponent(departmentParam));
    }
    const searchParam = searchParams.get("search");
    if (searchParam && !controlIdParam) {
      // Only set search if control_id is not present (to avoid overriding control_id filter)
      setSearchText(decodeURIComponent(searchParam));
    }
  }, [searchParams]);

  // Handle errors from React Query
  useEffect(() => {
    if (controlsError) {
      showToast(`Failed to fetch data: ${controlsError.message}`, 'error');
    }
  }, [controlsError, showToast]);

  // ✅ Parse comments safely
  const parseComments = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [{ text: value, time: "" }];
    } catch {
      return [{ text: value, time: "" }];
    }
  };

  // ✅ Export functions
  const exportToCSV = () => {
    if (!controls.length) return alert("No data to export!");
    const headers = Object.keys(controls[0]);
    const rows = controls.map((r) => headers.map((h) => JSON.stringify(r[h] || "")));
    const blob = new Blob(
      [headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv" }
    );
    saveAs(blob, "security_controls.csv");
  };

  const exportToExcel = async () => {
    if (!controls.length) return alert("No data to export!");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Controls");
    
    // Add headers from first object keys
    if (controls.length > 0) {
      const headers = Object.keys(controls[0]);
      worksheet.addRow(headers);
      
      // Add data rows
      controls.forEach(row => {
        worksheet.addRow(headers.map(key => row[key]));
      });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "security_controls.xlsx");
  };

  // ✅ Filtered and sorted data
  const filteredControls = useMemo(() => {
    let filtered = controls;

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          (r.id && String(r.id).toLowerCase().includes(searchLower)) ||
          (r.owner && r.owner.toLowerCase().includes(searchLower)) ||
          (r.control_domain && r.control_domain.toLowerCase().includes(searchLower)) ||
          (r.Priority && r.Priority.toLowerCase().includes(searchLower)) ||
          (r.Status && r.Status.toLowerCase().includes(searchLower)) ||
          (r.requirement && r.requirement.toLowerCase().includes(searchLower)) ||
          (r.description && r.description.toLowerCase().includes(searchLower)) ||
          (r.Comments && String(r.Comments).toLowerCase().includes(searchLower))
        );
      });
    }

    // Apply priority filter
    if (filterPriority) {
      filtered = filtered.filter((r) => r.Priority === filterPriority);
    }

    // Apply status filter
    if (filterStatus) {
      filtered = filtered.filter((r) => r.Status === filterStatus);
    }

    // Apply domain filter
    if (filterDomain) {
      filtered = filtered.filter((r) => r.control_domain === filterDomain);
    }

    // Apply assignee filter
    if (filterAssignee) {
      filtered = filtered.filter((r) => r.owner === filterAssignee);
    }

    // Apply department filter
    if (filterDepartment) {
      filtered = filtered.filter((r) => {
        const controlDept = r.department || "";
        // Match exact or case-insensitive
        return controlDept === filterDepartment || 
               controlDept.toLowerCase() === filterDepartment.toLowerCase();
      });
    }

    // Apply certification filter
    if (filterCertification) {
      filtered = filtered.filter((r) => {
        const controlCert = r.certification || "";
        // Match exact or case-insensitive
        if (controlCert === filterCertification || 
            controlCert.toLowerCase() === filterCertification.toLowerCase()) {
          return true;
        }
        // Also check if any certification in the list matches
        const matchingCert = certifications.find((cert) => 
          (cert.name && (cert.name === filterCertification || cert.name.toLowerCase() === filterCertification.toLowerCase())) ||
          (cert.certification_type && (cert.certification_type === filterCertification || cert.certification_type.toLowerCase() === filterCertification.toLowerCase()))
        );
        // If we found a matching cert, check if control's cert matches the cert's name or type
        if (matchingCert) {
          return (matchingCert.name && (controlCert === matchingCert.name || controlCert.toLowerCase() === matchingCert.name.toLowerCase())) ||
                 (matchingCert.certification_type && (controlCert === matchingCert.certification_type || controlCert.toLowerCase() === matchingCert.certification_type.toLowerCase()));
        }
        return false;
      });
    }

    return filtered;
  }, [controls, searchText, filterPriority, filterStatus, filterDomain, filterAssignee, filterDepartment, filterCertification, certifications]);

  // Get unique values for filter dropdowns
  const uniquePriorities = useMemo(() => {
    const priorities = new Set(controls.map((r) => r.Priority).filter(Boolean));
    return Array.from(priorities).sort();
  }, [controls]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(controls.map((r) => r.Status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [controls]);

  const uniqueDomains = useMemo(() => {
    const domains = new Set(controls.map((r) => r.control_domain).filter(Boolean));
    return Array.from(domains).sort();
  }, [controls]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set(controls.map((r) => r.owner).filter(Boolean));
    return Array.from(assignees).sort();
  }, [controls]);

  const uniqueDepartments = useMemo(() => {
    // Get unique department values, filtering out null, undefined, and empty strings
    const departments = new Set(
      controls
        .map((r) => r.department)
        .filter((dept) => dept && String(dept).trim() !== "")
    );
    return Array.from(departments).sort();
  }, [controls]);

  const uniqueCertifications = useMemo(() => {
    // Get unique certification values from controls
    const certs = new Set(controls.map((r) => r.certification).filter(Boolean));
    // Also include certifications from the certifications list (now an array of strings)
    certifications.forEach((cert) => {
      if (cert) certs.add(String(cert));
    });
    return Array.from(certs).sort();
  }, [controls, certifications]);

  // Get unique certification names for dropdown
  // certifications is now an array of strings (from useCertifications hook)
  const certificationOptions = useMemo(() => {
    const certs = new Set();
    // certifications is now an array of strings
    certifications.forEach((cert) => {
      if (cert) certs.add(String(cert));
    });
    // Also add certifications from controls (in case they're not in the list yet)
    controls.forEach((control) => {
      if (control.certification) certs.add(control.certification);
    });
    return Array.from(certs).sort();
  }, [certifications, controls]);

  // Calculate status metrics for cards
  const statusMetrics = useMemo(() => {
    const metrics = {};
    
    filteredControls.forEach((control) => {
      const status = control.Status || "Unknown";
      
      if (!metrics[status]) {
        metrics[status] = {
          status: status,
          count: 0
        };
      }
      
      metrics[status].count++;
    });
    
    return Object.values(metrics).sort((a, b) => a.status.localeCompare(b.status));
  }, [filteredControls]);

  // Calculate status vs department cross-tabulation
  const statusDeptTable = useMemo(() => {
    const table = {};
    const departments = new Set();
    
    filteredControls.forEach((control) => {
      const status = control.Status || "Unknown";
      const dept = control.department || "Unassigned";
      
      departments.add(dept);
      
      if (!table[status]) {
        table[status] = {};
      }
      
      if (!table[status][dept]) {
        table[status][dept] = 0;
      }
      
      table[status][dept]++;
    });
    
    const sortedDepts = Array.from(departments).sort();
    const sortedStatuses = Object.keys(table).sort();
    
    return {
      statuses: sortedStatuses,
      departments: sortedDepts,
      data: table
    };
  }, [filteredControls]);

  // ✅ Delete function
  const deleteControl = async (id) => {
    if (!hasPermission('security_controls', 'delete')) {
      showToast('You do not have permission to delete security controls', 'error');
      setConfirmDeleteId(null);
      return;
    }
    
    try {
      const json = await del(`/api/security-controls/${id}`);
      const err = json?.error;
      if (err) {
        const msg = typeof err === 'string' ? err : (err.message || err.detail || JSON.stringify(err));
        if (typeof msg === 'string' && (msg.includes('permission') || msg.includes('403'))) {
          showToast('You do not have permission to delete security controls', 'error');
        } else {
          throw new Error(msg);
        }
      } else {
        showToast('Security control deleted successfully', 'success');
        invalidateSecurityControls();
      }
    } catch (e) {
      const msg = e?.message || 'Delete failed';
      if (typeof msg === 'string' && (msg.includes('permission') || msg.includes('403'))) {
        showToast('You do not have permission to delete security controls', 'error');
      } else {
        showToast(`Failed to delete security control: ${msg}`, 'error');
      }
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ✅ Handle view control - open modal instead of navigating
  const handleViewControl = (control) => {
    if (!hasPermission('security_controls', 'retrieve')) {
      showToast('You do not have permission to view security controls', 'error');
      return;
    }
    setViewingControlId(control.id);
  };

  // ✅ Columns
  const columns = [
    {
      name: "ID",
      selector: (r) => r.id,
      sortable: true,
      cell: (r) => (
        <button
          onClick={() => handleViewControl(r)}
          className="text-purple-600 hover:underline font-medium"
        >
          {r.id}
        </button>
      ),
    },
    { 
      name: "Owner", 
      selector: (r) => {
        const owner = r.owner || "";
        // Extract email if owner contains email, otherwise return as is
        const emailMatch = owner.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        return emailMatch ? emailMatch[0] : owner;
      }, 
      sortable: true 
    },
    {
      name: "Department",
      selector: (r) => r.department || "",
      sortable: true,
    },
    {
      name: "Domain",
      selector: (r) => r.control_domain || "",
      sortable: true,
      wrap: true,
      cell: (r) => (
        <div
          className="truncate max-w-[220px] hover:whitespace-normal hover:bg-gray-50 hover:shadow-md hover:rounded-md px-1 transition-all duration-150 cursor-help"
          title={r.control_domain}
        >
          {r.control_domain}
        </div>
      ),
    },
    {
      name: "Priority",
      selector: (r) => r.Priority || "",
      sortable: true,
      cell: (r) => (
        <span
          className={`font-semibold ${
            r.Priority === "Critical"
              ? "text-red-600"
              : r.Priority === "High"
              ? "text-orange-600"
              : "text-gray-700"
          }`}
        >
          {r.Priority}
        </span>
      ),
    },
    {
      name: "Status",
      selector: (r) => r.Status || "",
      sortable: true,
      cell: (r) => (
        <div
          className="truncate max-w-[180px] hover:whitespace-normal hover:bg-gray-50 hover:shadow-md hover:rounded-md px-1 transition-all duration-150 cursor-help"
          title={r.Status}
        >
          {r.Status}
        </div>
      ),
    },
    {
      name: "Certification",
      selector: (r) => r.certification || "",
      sortable: true,
      cell: (r) => (
        <span style={{ 
          fontWeight: "500", 
          color: r.certification ? THEME_COLORS.darkTeal : "#9ca3af" 
        }}>
          {r.certification || "—"}
        </span>
      ),
    },
    {
      name: "Last Review Date",
      selector: (r) => {
        if (!r.Review_Date) return "Not Reviewed";
        // Extract only date part (remove time if present)
        const dateStr = r.Review_Date.replaceAll("/", "-");
        // If it contains time (has space or T), extract just the date part
        const dateOnly = dateStr.split(/[\sT]/)[0];
        return dateOnly;
      },
      sortable: true,
    },
    {
      name: "Updated Date",
      selector: (r) => {
        if (!r.updated_at) return "—";
        // Handle ISO format dates (e.g., "2024-01-15T10:30:00Z" or "2024-01-15 10:30:00")
        const dateStr = r.updated_at;
        // Extract only date part (remove time if present)
        const dateOnly = dateStr.split(/[\sT]/)[0];
        // Format as YYYY-MM-DD or return as is if already formatted
        return dateOnly;
      },
      sortable: true,
      cell: (r) => {
        if (!r.updated_at) return <span className="text-gray-400">—</span>;
        // Format the date nicely
        const dateStr = r.updated_at;
        const dateOnly = dateStr.split(/[\sT]/)[0];
        // Convert YYYY-MM-DD to a more readable format if needed
        const dateParts = dateOnly.split("-");
        if (dateParts.length === 3) {
          return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
        return dateOnly;
      },
    },
    {
      name: "Actions",
      style: { textAlign: 'center' },
      cell: (r) => (
        <div className="flex items-center justify-center gap-2">
          {hasPermission('security_controls', 'retrieve') && (
            <button
              onClick={() => setViewingControlId(r.id)}
              className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-blue-50"
              style={{ color: THEME_COLORS.darkTeal }}
              title="View"
            >
              <Eye size={16} />
            </button>
          )}
          {hasPermission('security_controls', 'update') && (
            <button
              onClick={() => setEditingControlId(r.id)}
              className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-cyan-50"
              style={{ color: THEME_COLORS.mediumTeal }}
              title="Edit"
            >
              <FileEdit size={16} />
            </button>
          )}
          {hasPermission('security_controls', 'delete') && (
            <button
              onClick={() => setConfirmDeleteId(r.id)}
              className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-red-50"
              style={{ color: "#dc3545" }}
              title="Delete"
            >
              <Trash size={16} />
            </button>
          )}
        </div>
      ),
      ignoreRowClick: true,
    },
  ];

  // Show loader only until session is loaded, then show UI immediately
  if (sessionLoading) {
    return <Loader message="Loading..." />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.security_controls, { className: "w-6 h-6 text-gray-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">
            Security Controls
          </h1>
        </div>
        {hasPermission('security_controls', 'create') && (
          <button
            onClick={() => setCreatingControl(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all shadow-sm hover:shadow-md"
            style={{
              background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
            }}
          >
            <Plus size={18} />
            Create Control
          </button>
        )}
      </div>

      {/* Certification Searchable Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Certification to View Controls
        </label>
        {certificationsLoading ? (
          <div className="flex items-center gap-2 p-2">
            <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted text-sm">Loading certifications...</span>
          </div>
        ) : (
          <CertificationSearchableDropdown
            value={selectedCertification}
            onChange={(cert) => {
              const certValue = cert && String(cert).trim() !== '' ? String(cert).trim() : '';
              // Invalidate all security controls cache to force fresh fetch
              invalidateSecurityControls();
              setSelectedCertification(certValue);
              // Clear client-side certification filter when DB filter is applied
              if (certValue) {
                setFilterCertification("");
              }
            }}
            options={certificationOptions}
            placeholder="Search and select certification..."
          />
        )}
        {selectedCertification && (
          <p className="mt-2 text-sm text-gray-600">
            Showing controls for certification: <span className="font-semibold">{selectedCertification}</span>
          </p>
        )}
        {!selectedCertification && (
          <p className="mt-2 text-sm text-gray-500 italic">
            Please select a certification from the dropdown above to view security controls.
          </p>
        )}
      </div>

      {/* Show loading state when fetching controls */}
      {selectedCertification && controlsLoading && (
        <div className="mb-6">
          <Loader message="Loading security controls..." />
        </div>
      )}

      {/* Show error if any */}
      {selectedCertification && controlsError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            Failed to load controls: {controlsError.message || "Unknown error"}
          </p>
        </div>
      )}

      {/* Show message when no certification selected */}
      {!selectedCertification && (
        <div className="mb-6 p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600">
            No controls loaded. Please select a certification from the dropdown above to view security controls.
          </p>
        </div>
      )}

      {/* Status Cards and Table in One Row - Only show when certification is selected and data is loaded */}
      {selectedCertification && !controlsLoading && (statusMetrics.length > 0 || (statusDeptTable.statuses.length > 0 && statusDeptTable.departments.length > 0)) && (
        <div className="mb-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Status Cards - Left Column */}
            <div className="col-span-12 md:col-span-4 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Status Overview</h2>
              {statusMetrics.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {statusMetrics.map((statusMetric) => (
                    <div
                      key={statusMetric.status}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 text-center h-full flex flex-col justify-center"
                    >
                      <div className="text-sm font-medium text-gray-600 mb-2">{statusMetric.status}</div>
                      <div className="text-2xl font-bold text-gray-800">{statusMetric.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500">
                  No status data available
                </div>
              )}
            </div>

            {/* Status vs Department Table - Right Column */}
            <div className="col-span-12 md:col-span-8 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Status vs Department</h2>
              {statusDeptTable.statuses.length > 0 && statusDeptTable.departments.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto flex-1">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Status</th>
                        {statusDeptTable.departments.map((dept) => (
                          <th key={dept} className="px-2 py-2 text-center font-semibold text-gray-700 text-xs min-w-[80px]">
                            {dept.length > 10 ? dept.substring(0, 10) + '...' : dept}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-gray-100 text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusDeptTable.statuses.map((status) => {
                        const rowTotal = statusDeptTable.departments.reduce((sum, dept) => {
                          return sum + (statusDeptTable.data[status][dept] || 0);
                        }, 0);
                        
                        return (
                          <tr key={status} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800 text-xs">{status}</td>
                            {statusDeptTable.departments.map((dept) => (
                              <td key={dept} className="px-2 py-2 text-center text-gray-700 text-xs">
                                {statusDeptTable.data[status][dept] || 0}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center font-semibold text-gray-800 bg-gray-50 text-xs">{rowTotal}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-semibold text-gray-800 text-xs">Total</td>
                        {statusDeptTable.departments.map((dept) => {
                          const colTotal = statusDeptTable.statuses.reduce((sum, status) => {
                            return sum + (statusDeptTable.data[status][dept] || 0);
                          }, 0);
                          return (
                            <td key={dept} className="px-2 py-2 text-center font-semibold text-gray-800 text-xs">
                              {colTotal}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-gray-900 bg-gray-200 text-xs">
                          {filteredControls.length}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table View - Only show when certification is selected */}
      {selectedCertification && activeTab === "table" && (
        <>
          {/* Search and Filters */}
          <div 
            className="mb-4"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              width: "100%"
            }}
          >
            {/* First Row: Search Box */}
            <div style={{ 
                position: "relative", 
                maxWidth: "400px", 
                width: "100%"
              }}>
                <Search
                  size={18}
                  style={{ 
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    zIndex: 10,
                    color: "#6b7280"
                  }}
                />
                <input
                  type="text"
                  placeholder="Search security controls..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem 0.5rem 2.5rem",
                    border: `1px solid ${THEME_COLORS.lightBlue}`,
                    borderRadius: "0.5rem",
                    height: "38px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

            {/* Second Row: Filter Dropdowns */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.75rem",
              width: "100%"
            }}>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Priorities</option>
                {uniquePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Domains</option>
                {uniqueDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>

              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Assignees</option>
                {uniqueAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>

              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={filterCertification}
                onChange={(e) => setFilterCertification(e.target.value)}
                style={{
                  minWidth: "150px",
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.5rem",
                  height: "38px",
                  boxSizing: "border-box"
                }}
              >
                <option value="">All Certifications</option>
                {uniqueCertifications.map((cert) => (
                  <option key={cert} value={cert}>
                    {cert}
                  </option>
                ))}
              </select>

              {/* Clear Filters Button */}
              {(filterPriority || filterStatus || filterDomain || filterAssignee || filterDepartment || filterCertification || searchText) && (
                <button
                  onClick={() => {
                    setFilterPriority("");
                    setFilterStatus("");
                    setFilterDomain("");
                    setFilterAssignee("");
                    setFilterDepartment("");
                    setFilterCertification("");
                    setSearchText("");
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    border: `1px solid ${THEME_COLORS.lightBlue}`,
                    borderRadius: "0.5rem",
                    background: THEME_COLORS.offWhite,
                    color: THEME_COLORS.darkTeal,
                    height: "38px",
                    boxSizing: "border-box",
                    cursor: "pointer"
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Export Buttons and Per Page Selector */}
          <div 
            className="flex justify-end mb-3 gap-2"
            style={{
              background: "#ffffff",
              paddingTop: "0.75rem",
              paddingBottom: "0.75rem",
              marginTop: "0.5rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexShrink: 0
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", color: "#374151", fontWeight: "500" }}>
                Records per page:
              </label>
              <select
                value={perPage}
                onChange={(e) => {
                  const newPerPage = Number(e.target.value);
                  setPerPage(newPerPage);
                  setCurrentPage(1); // Reset to page 1 when changing records per page
                  // Save to localStorage
                  localStorage.setItem('securityControlsPerPage', newPerPage.toString());
                }}
                style={{
                  padding: "0.375rem 0.75rem",
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  background: "#ffffff",
                  cursor: "pointer",
                  minWidth: "80px",
                  zIndex: 100
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
            <button
              onClick={exportToCSV}
              className="btn"
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                color: "#ffffff",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
              }}
            >
              Export CSV
            </button>
            <button
              onClick={exportToExcel}
              className="btn"
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                color: "#ffffff",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
              }}
            >
              Export Excel
            </button>
          </div>

          <DataTable
            key={`table-${perPage}`}
            columns={columns}
            data={filteredControls}
            pagination
            paginationPerPage={perPage}
            paginationDefaultPage={currentPage}
            paginationRowsPerPageOptions={[20, 50, 100, 200, 500]}
            onChangeRowsPerPage={(currentRowsPerPage, currentPage) => {
              setPerPage(currentRowsPerPage);
              setCurrentPage(1); // Reset to page 1
              localStorage.setItem('securityControlsPerPage', currentRowsPerPage.toString());
            }}
            onChangePage={(page, totalRows) => {
              setCurrentPage(page);
            }}
            highlightOnHover
            striped
            dense
            responsive
            sortIcon={<span>⇅</span>}
            noDataComponent="No security controls found"
          />
        </>
      )}


      {/* View Modal */}
      {viewingControlId && (
        <SecurityControlViewModal
          open={!!viewingControlId}
          onClose={() => setViewingControlId(null)}
          controlId={viewingControlId}
          onEdit={(id) => {
            setViewingControlId(null);
            setEditingControlId(id);
          }}
        />
      )}

      {/* Create Modal */}
      {creatingControl && (
        <SecurityControlCreateModal
          open={creatingControl}
          onClose={() => setCreatingControl(false)}
          onSuccess={() => {
            // Invalidate and refetch controls after successful create
            invalidateSecurityControls();
          }}
          certification={selectedCertification}
        />
      )}

      {/* Edit Modal */}
      {editingControlId && (
        <SecurityControlEditModal
          open={!!editingControlId}
          onClose={() => setEditingControlId(null)}
          controlId={editingControlId}
          onSuccess={() => {
            // Invalidate and refetch controls after successful edit
            invalidateSecurityControls();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <ModernModal
          open={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          title="Confirm Delete"
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => deleteControl(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-gray-700">
            Are you sure you want to delete this security control? This action cannot be undone.
          </p>
        </ModernModal>
      )}
    </div>
  );
}
