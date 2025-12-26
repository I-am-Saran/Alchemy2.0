import React, { useEffect, useState, useMemo } from "react";
import DataTable from "react-data-table-component";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { useSession } from "../contexts/SessionContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, del } from "../services/api";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { Search, Plus, Eye, FileEdit, Trash } from "lucide-react";
import { THEME_COLORS } from "../constants/colors";
import ModernModal from "../components/ModernModal";
import Loader from "../components/Loader";

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewCertification, setViewCertification] = useState(null);

  // ✅ Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(`/api/certifications?tenant_id=${encodeURIComponent(tenant_id)}`);
        if (json.error) throw new Error(json.error);
        setCertifications(json.data || []);
      } catch (err) {
        showToast(`Failed to fetch data: ${err.message}`, 'error');
        setCertifications([]);
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading && session) fetchData();
  }, [sessionLoading, session]);

  // ✅ Export functions
  const exportToCSV = () => {
    if (!filteredCertifications.length) return alert("No data to export!");
    const headers = Object.keys(filteredCertifications[0]);
    const rows = filteredCertifications.map((r) => headers.map((h) => JSON.stringify(r[h] || "")));
    const blob = new Blob(
      [headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv" }
    );
    saveAs(blob, "certifications.csv");
  };

  const exportToExcel = async () => {
    if (!filteredCertifications.length) return alert("No data to export!");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Certifications");
    
    // Add headers from first object keys
    if (filteredCertifications.length > 0) {
      const headers = Object.keys(filteredCertifications[0]);
      worksheet.addRow(headers);
      
      // Add data rows
      filteredCertifications.forEach(row => {
        worksheet.addRow(headers.map(key => row[key]));
      });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "certifications.xlsx");
  };

  // ✅ Filtered and sorted data
  const filteredCertifications = useMemo(() => {
    let filtered = certifications;

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          (r.name && r.name.toLowerCase().includes(searchLower)) ||
          (r.certification_type && r.certification_type.toLowerCase().includes(searchLower)) ||
          (r.certificate_number && r.certificate_number.toLowerCase().includes(searchLower)) ||
          (r.certifying_body && r.certifying_body.toLowerCase().includes(searchLower)) ||
          (r.description && r.description.toLowerCase().includes(searchLower)) ||
          (r.scope && r.scope.toLowerCase().includes(searchLower)) ||
          (r.notes && r.notes.toLowerCase().includes(searchLower))
        );
      });
    }

    // Apply type filter
    if (filterType) {
      filtered = filtered.filter((r) => r.certification_type === filterType);
    }

    // Apply status filter
    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    return filtered;
  }, [certifications, searchText, filterType, filterStatus]);

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = new Set(certifications.map((r) => r.certification_type).filter(Boolean));
    return Array.from(types).sort();
  }, [certifications]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(certifications.map((r) => r.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [certifications]);

  const deleteCertification = async (id) => {
    if (!hasPermission('certifications', 'delete')) {
      showToast('You do not have permission to delete certifications', 'error');
      setConfirmDeleteId(null);
      return;
    }
    
    try {
      const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
      const json = await del(`/api/certifications/${id}?tenant_id=${encodeURIComponent(tenant_id)}`);
      if (json.error) {
        if (json.error.includes('permission') || json.error.includes('403')) {
          showToast('You do not have permission to delete certifications', 'error');
        } else {
          throw new Error(json.error);
        }
      } else {
        showToast('Certification deleted successfully', 'success');
        // Reload data
        const fetchData = async () => {
          try {
            const json = await get(`/api/certifications?tenant_id=${encodeURIComponent(tenant_id)}`);
            if (json.error) throw new Error(json.error);
            setCertifications(json.data || []);
          } catch (err) {
            showToast(`Failed to fetch data: ${err.message}`, 'error');
          }
        };
        fetchData();
      }
    } catch (e) {
      if (e.message && (e.message.includes('permission') || e.message.includes('403'))) {
        showToast('You do not have permission to delete certifications', 'error');
      } else {
        showToast(`Failed to delete certification: ${e.message}`, 'error');
      }
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ✅ Columns
  const columns = [
    {
      name: "Name",
      selector: (r) => r.name || "",
      sortable: true,
      cell: (r) => (
        <button
          onClick={() => setViewCertification(r)}
          className="text-purple-600 hover:underline font-medium"
        >
          {r.name}
        </button>
      ),
    },
    {
      name: "Type",
      selector: (r) => r.certification_type || "",
      sortable: true,
    },
    {
      name: "Version",
      selector: (r) => r.version || "",
      sortable: true,
    },
    {
      name: "Status",
      selector: (r) => r.status || "",
      sortable: true,
      cell: (r) => {
        const status = r.status || "Active";
        const statusColors = {
          Active: "text-green-600",
          Expired: "text-red-600",
          Pending: "text-yellow-600",
          "Renewal Due": "text-orange-600",
          Suspended: "text-gray-600",
          Revoked: "text-red-800",
        };
        return (
          <span className={`font-semibold ${statusColors[status] || "text-gray-700"}`}>
            {status}
          </span>
        );
      },
    },
    {
      name: "Issue Date",
      selector: (r) => r.issue_date || "",
      sortable: true,
    },
    {
      name: "Expiry Date",
      selector: (r) => r.expiry_date || "",
      sortable: true,
      cell: (r) => {
        const expiry = r.expiry_date;
        if (!expiry) return "—";
        const expiryDate = new Date(expiry);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          return <span className="text-red-600 font-semibold">{expiry}</span>;
        } else if (daysUntilExpiry <= 30) {
          return <span className="text-orange-600 font-semibold">{expiry}</span>;
        }
        return expiry;
      },
    },
    {
      name: "Certifying Body",
      selector: (r) => r.certifying_body || "",
      sortable: true,
    },
    {
      name: "Actions",
      cell: (r) => (
        <div className="d-flex gap-2">
          {hasPermission('certifications', 'retrieve') && (
            <button
              onClick={() => setViewCertification(r)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.darkTeal }}
              title="View"
            >
              <Eye size={16} />
            </button>
          )}
          {hasPermission('certifications', 'update') && (
            <button
              onClick={() => navigate(`/certifications/edit/${r.id}`)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.mediumTeal }}
              title="Edit"
            >
              <FileEdit size={16} />
            </button>
          )}
          {hasPermission('certifications', 'delete') && (
            <button
              onClick={() => setConfirmDeleteId(r.id)}
              className="btn btn-sm p-1"
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

  if (sessionLoading || loading) {
    return <Loader message="Loading certifications..." />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.certifications, { className: "w-6 h-6 text-gray-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">
            Certifications
          </h1>
        </div>
        {hasPermission('certifications', 'create') && (
          <button
            onClick={() => navigate("/certifications/new")}
            className="btn d-flex align-items-center gap-2"
            style={{
              background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
            }}
          >
            <Plus size={18} /> <span>Create Certification</span>
          </button>
        )}
      </div>

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
            placeholder="Search certifications..."
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              minWidth: "150px",
              padding: "0.5rem 0.75rem",
              border: `1px solid ${THEME_COLORS.lightBlue}`,
              borderRadius: "0.5rem",
              height: "38px",
              boxSizing: "border-box"
            }}
          >
            <option value="">All Types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
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

          {/* Clear Filters Button */}
          {(filterType || filterStatus || searchText) && (
            <button
              onClick={() => {
                setFilterType("");
                setFilterStatus("");
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

      {/* Export Buttons */}
      <div className="flex justify-end mb-3 gap-2">
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
        columns={columns}
        data={filteredCertifications}
        pagination
        highlightOnHover
        striped
        dense
        responsive
        sortIcon={<span>⇅</span>}
      />

      {/* View Modal */}
      {viewCertification && (
        <ModernModal
          open={!!viewCertification}
          onClose={() => setViewCertification(null)}
          title="Certification Details"
          maxWidth="max-w-3xl"
          footer={
            <div className="flex justify-end gap-2">
              {hasPermission('certifications', 'update') && (
                <button
                  className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                  onClick={() => {
                    navigate(`/certifications/edit/${viewCertification.id}`);
                    setViewCertification(null);
                  }}
                >
                  Edit
                </button>
              )}
              <button
                className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => setViewCertification(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">ID</div>
              <div className="font-medium">{viewCertification.id || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Name</div>
              <div className="font-medium">{viewCertification.name || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Type</div>
              <div className="font-medium">{viewCertification.certification_type || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Version</div>
              <div className="font-medium">{viewCertification.version || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Status</div>
              <div className="font-medium">{viewCertification.status || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Issue Date</div>
              <div className="font-medium">{viewCertification.issue_date || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Expiry Date</div>
              <div className="font-medium">{viewCertification.expiry_date || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Renewal Date</div>
              <div className="font-medium">{viewCertification.renewal_date || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Certifying Body</div>
              <div className="font-medium">{viewCertification.certifying_body || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Certificate Number</div>
              <div className="font-medium">{viewCertification.certificate_number || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Scope</div>
              <div className="font-medium">{viewCertification.scope || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Attachment URL</div>
              <div className="font-medium">
                {viewCertification.attachment_url ? (
                  <a href={viewCertification.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {viewCertification.attachment_url}
                  </a>
                ) : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Created At</div>
              <div className="font-medium">
                {viewCertification.created_at ? String(viewCertification.created_at).replace("T", " ").substring(0, 19) : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Updated At</div>
              <div className="font-medium">
                {viewCertification.updated_at ? String(viewCertification.updated_at).replace("T", " ").substring(0, 19) : "—"}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-gray-600 mb-1">Description</div>
              <div className="font-medium whitespace-pre-wrap">{viewCertification.description || "—"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-gray-600 mb-1">Notes</div>
              <div className="font-medium whitespace-pre-wrap">{viewCertification.notes || "—"}</div>
            </div>
            {viewCertification.attachment_url && (
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-gray-600 mb-1">Attachment</div>
                <a
                  href={viewCertification.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {viewCertification.attachment_url}
                </a>
              </div>
            )}
          </div>
        </ModernModal>
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
                onClick={() => deleteCertification(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-gray-700">
            Are you sure you want to delete this certification? This action cannot be undone.
          </p>
        </ModernModal>
      )}
    </div>
  );
}

