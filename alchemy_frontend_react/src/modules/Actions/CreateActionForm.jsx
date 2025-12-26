import { useState } from 'react'
import { X } from 'lucide-react'
import FormInput from '../../components/FormInput'
import { post } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { useSession } from '../../contexts/SessionContext'
import { THEME_COLORS } from '../../constants/colors'

const priorityOptions = ["Low", "Medium", "High", "Critical"]
const statusOptions = ["Open", "In Progress", "Completed", "Cancelled"]
const actionTypeOptions = ["Remediation", "Improvement", "Compliance", "Review", "Other"]

export default function CreateActionForm({ onClose, controlId, onSuccess }) {
  const { showToast } = useToast()
  const { session } = useSession()
  const [form, setForm] = useState({
    action_name: '',
    action_description: '',
    action_priority: 'Medium',
    action_status: 'Open',
    action_type: 'Remediation',
    assigned_to: '',
    due_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!controlId) {
      showToast('Control ID is required', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        control_id: controlId,
        action_name: form.action_name,
        action_description: form.action_description,
        action_priority: form.action_priority,
        action_status: form.action_status,
        action_type: form.action_type,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        notes: form.notes || null,
      }

      const json = await post('/api/actions', payload)
      if (json.error) {
        throw new Error(json.error)
      }

      showToast('Action created successfully', 'success')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      showToast(`Failed to create action: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Create Action Form"
        className="relative w-[95%] max-w-4xl bg-white rounded-xl border border-[#DDE6D5] shadow-xl z-10"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE6D5]">
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLORS.darkTeal }}>Create New Action</h2>
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
        <form onSubmit={onSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <FormInput
                type="text"
                label="Action Name"
                value={form.action_name}
                onChange={e => updateField('action_name', e.target.value)}
                placeholder="Enter action name"
                required
              />

              <FormInput
                type="select"
                label="Action Type"
                value={form.action_type}
                onChange={e => updateField('action_type', e.target.value)}
                options={actionTypeOptions}
                placeholder="Select action type"
                required
              />

              <FormInput
                type="select"
                label="Priority"
                value={form.action_priority}
                onChange={e => updateField('action_priority', e.target.value)}
                options={priorityOptions}
                placeholder="Select priority"
                required
              />

              <FormInput
                type="select"
                label="Status"
                value={form.action_status}
                onChange={e => updateField('action_status', e.target.value)}
                options={statusOptions}
                placeholder="Select status"
                required
              />
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <FormInput
                type="text"
                label="Assigned To"
                value={form.assigned_to}
                onChange={e => updateField('assigned_to', e.target.value)}
                placeholder="Enter email or name"
              />

              <FormInput
                type="date"
                label="Due Date"
                value={form.due_date}
                onChange={e => updateField('due_date', e.target.value)}
              />
            </div>
          </div>

          {/* Full width fields */}
          <div className="mt-4 space-y-4">
            <FormInput
              type="textarea"
              label="Action Description"
              value={form.action_description}
              onChange={e => updateField('action_description', e.target.value)}
              placeholder="Describe the action in detail"
              rows={4}
              required
            />

            <FormInput
              type="textarea"
              label="Notes"
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
            />
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
                background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`;
                }
              }}
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

