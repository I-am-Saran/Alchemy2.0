import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import FormField from '../../components/FormField'
import UserAutocomplete from '../../components/UserAutocomplete'
import { post, get } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { useSession } from '../../contexts/SessionContext'
import { usePermissions } from '../../hooks/usePermissions'
import { THEME_COLORS } from '../../constants/colors'

export default function CreateTaskDialog({ onClose, controlId, controlUuid, onSuccess }) {
  const { showToast } = useToast()
  const { session } = useSession()
  const { hasPermission, userRoles, loading: permsLoading } = usePermissions()
  
  // Check if user is superadmin - handle both nested structure and direct structure
  const isSuperAdmin = React.useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false
    
    // Debug logging
    console.log('[CreateTaskDialog] Checking superadmin status, userRoles:', userRoles)
    
    return userRoles.some((userRole) => {
      // Try nested structure first (from API: user_roles with roles relation)
      const roleName = userRole?.roles?.role_name || userRole?.role_name || ''
      const normalized = roleName.toLowerCase().trim()
      const isSuper = normalized === 'super admin' || normalized === 'superadmin'
      
      if (isSuper) {
        console.log('[CreateTaskDialog] Superadmin detected! Role name:', roleName)
      }
      
      return isSuper
    })
  }, [userRoles])
  
  // Helper function to check permission or superadmin
  // Don't check permissions while loading
  const canCreateTask = !permsLoading && (isSuperAdmin || hasPermission('tasks', 'create'))
  
  const [taskName, setTaskName] = useState("")
  const [taskNote, setTaskNote] = useState("")
  const [taskPriority, setTaskPriority] = useState("Low")
  const [taskType, setTaskType] = useState("Observation")
  const [taskStatus, setTaskStatus] = useState("Open")
  const [controlStage, setControlStage] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [auditOwner, setAuditOwner] = useState("")
  const [auditId, setAuditId] = useState("")
  const [audits, setAudits] = useState([])
  const [attachmentUrl, setAttachmentUrl] = useState("")
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  // Fetch audits for dropdown - only when dialog is actually open
  useEffect(() => {
    if (!session) return
    
    const fetchAudits = async () => {
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001"
        const json = await get(`/api/audits?tenant_id=${encodeURIComponent(tenant_id)}`)
        if (!json.error && Array.isArray(json.data)) {
          setAudits(json.data)
        }
      } catch (e) {
        console.error("Failed to load audits:", e)
      }
    }
    fetchAudits()
  }, [session])

  useEffect(() => {
    // Wait for permissions to load before checking
    if (permsLoading) return
    
    if (!canCreateTask) {
      showToast('You do not have permission to create tasks', 'error')
      onClose?.()
    }
  }, [canCreateTask, permsLoading, showToast, onClose])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!controlId) {
      showToast('Control ID is required', 'error')
      return
    }

    if (!canCreateTask) {
      showToast('You do not have permission to create tasks', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        control_id: controlId,
        control_uuid: controlUuid || null,
        audit_id: auditId || null,
        task_name: taskName,
        task_note: taskNote,
        task_priority: taskPriority,
        task_type: taskType,
        task_status: taskStatus,
        control_stage: controlStage,
        assigned_to: assignedTo || "",
        audit_owner: auditOwner || "",
        attachment: attachmentUrl || "",
        comments: [],
      }

      const json = await post('/api/tasks', payload)
      if (json.error) {
        throw new Error(json.error)
      }

      // Handle file upload if present
      if (file && json.data?.id) {
        const form = new FormData()
        form.append("file", file)
        const token = sessionStorage.getItem('auth_token')
        const BASE_URL = import.meta.env.VITE_API_BASE_URL || ""
        const uploadResp = await fetch(`${BASE_URL}/api/tasks/${json.data.id}/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        const uploadJson = await uploadResp.json()
        if (!uploadResp.ok || uploadJson.error) {
          throw new Error(uploadJson.error || uploadResp.statusText)
        }
      }

      showToast('Task created successfully', 'success')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      showToast(`Failed to create task: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Don't render if permissions are still loading
  if (permsLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative bg-white rounded-xl p-6 z-10">
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      </div>
    )
  }
  
  if (!canCreateTask) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Create Task Form"
        className="relative w-[95%] max-w-4xl bg-white rounded-xl border border-[#DDE6D5] shadow-xl z-10 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE6D5]">
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLORS.darkTeal }}>Create New Task</h2>
          <button 
            aria-label="Close" 
            onClick={onClose} 
            className="p-2 rounded transition-colors"
            style={{ color: THEME_COLORS.darkTeal }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME_COLORS.lightMint;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField 
              label="Control ID" 
              value={controlId || ""} 
              onChange={() => {}} 
              placeholder="e.g., CDE-005" 
              readOnly={true} 
            />
            <FormField 
              label="Task Name" 
              value={taskName} 
              onChange={(e) => setTaskName(e.target.value)} 
              placeholder="Concise task name" 
              required
            />
            <FormField
              label="Task Priority"
              type="select"
              value={taskPriority}
              onChange={(val) => setTaskPriority(val)}
              options={[
                { label: "Low", value: "Low" },
                { label: "Medium", value: "Medium" },
                { label: "High", value: "High" },
                { label: "Critical", value: "Critical" },
              ]}
            />
            <FormField
              label="Task Type"
              type="select"
              value={taskType}
              onChange={(val) => setTaskType(val)}
              options={[
                { label: "Observation", value: "Observation" },
                { label: "Improvement", value: "Improvement" },
                { label: "Compliance", value: "Compliance" },
                { label: "Technical", value: "Technical" },
                { label: "External", value: "External" },
                { label: "Risk", value: "Risk" },
                { label: "IGS", value: "IGS" },
                { label: "Bug - Functional", value: "Bug - Functional" },
                { label: "Bug - Security", value: "Bug - Security" },
                { label: "Bug - Performance", value: "Bug - Performance" },
                { label: "Other", value: "Other" },
              ]}
            />
            <FormField
              label="Control Stage"
              type="select"
              value={controlStage}
              onChange={(val) => setControlStage(val)}
              options={[
                { label: "Plan", value: "Plan" },
                { label: "Do", value: "Do" },
                { label: "Check", value: "Check" },
                { label: "Act", value: "Act" },
              ]}
            />
            <FormField
              label="Task Status"
              type="select"
              value={taskStatus}
              onChange={(val) => setTaskStatus(val)}
              options={[
                { label: "Open", value: "Open" },
                { label: "In Progress", value: "In Progress" },
                { label: "Closed", value: "Closed" },
                { label: "On Hold", value: "On Hold" },
              ]}
            />
            <div>
              <UserAutocomplete
                label="Assigned To"
                value={assignedTo}
                onChange={setAssignedTo}
                placeholder="Search by email..."
                fieldType="assignee"
              />
            </div>
            <div>
              <UserAutocomplete
                label="Audit Owner"
                value={auditOwner}
                onChange={setAuditOwner}
                placeholder="Search by email..."
                fieldType="assignee"
              />
            </div>
            <FormField
              label="Audit"
              type="select"
              value={auditId}
              onChange={(val) => setAuditId(val)}
              options={[
                { label: "None", value: "" },
                ...audits.map(audit => ({
                  label: audit.audit_name || audit.id,
                  value: audit.id
                }))
              ]}
            />
          </div>

          <FormField 
            label="Task Note" 
            type="textarea" 
            value={taskNote} 
            onChange={(e) => setTaskNote(e.target.value)} 
            placeholder="Details, context, next steps" 
            rows={4}
          />

          <div className="mt-4">
            <label className="block text-gray-700 font-medium mb-1">Attachment</label>
            <input 
              type="file" 
              className="w-full border border-gray-300 rounded-lg px-3 py-2" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
            {attachmentUrl && (
              <p className="text-sm text-gray-600 mt-1">
                Current: <a className="text-violet-700 underline" href={attachmentUrl} target="_blank" rel="noreferrer">View</a>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                background: THEME_COLORS.lightMint,
                color: THEME_COLORS.darkTeal,
                border: `1px solid ${THEME_COLORS.lightBlue}`,
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = THEME_COLORS.lightBlue;
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = THEME_COLORS.lightMint;
                  e.currentTarget.style.color = THEME_COLORS.darkTeal;
                }
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-lg text-white transition-all shadow-sm hover:shadow-md"
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                }
              }}
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

