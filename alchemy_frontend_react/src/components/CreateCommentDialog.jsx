import { useState } from 'react'
import { X } from 'lucide-react'
import { post, put, get } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useSession } from '../contexts/SessionContext'
import { THEME_COLORS } from '../constants/colors'

export default function CreateCommentDialog({ onClose, controlId, taskId, actionId, type = 'control', onSuccess }) {
  const { showToast } = useToast()
  const { session } = useSession()
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) {
      showToast('Comment cannot be empty', 'error')
      return
    }

    if (type === 'control' && !controlId) {
      showToast('Control ID is required', 'error')
      return
    }

    if (type === 'task' && !taskId) {
      showToast('Task ID is required', 'error')
      return
    }

    if (type === 'action' && !actionId) {
      showToast('Action ID is required', 'error')
      return
    }

    setSaving(true)
    try {
      const now = new Date()
      const stamp = now.toLocaleString()
      const comment = {
        text: commentText.trim(),
        time: stamp,
        author: session?.user?.email || '',
      }

      if (type === 'control') {
        const json = await post(`/api/security-controls/${controlId}/comments`, {
          comment: comment,
        })

        if (json.error) {
          throw new Error(json.error)
        }
      } else if (type === 'task') {
        // Use dedicated comments endpoint for tasks
        const tenant_id = session?.tenant_id || '00000000-0000-0000-0000-000000000001'
        const json = await post(`/api/tasks/${taskId}/comments?tenant_id=${encodeURIComponent(tenant_id)}`, {
          comment: comment,
        })

        if (json.error) {
          throw new Error(json.error)
        }
      } else if (type === 'action') {
        // For actions, we need to update the action's comments field
        // First, get the current action
        const tenant_id = session?.tenant_id || '00000000-0000-0000-0000-000000000001'
        const actionJson = await get(`/api/actions/${actionId}?tenant_id=${encodeURIComponent(tenant_id)}`)
        if (actionJson.error) {
          throw new Error(actionJson.error)
        }

        const currentAction = actionJson.data
        let existingComments = []
        
        // Parse existing comments
        try {
          if (typeof currentAction.comments === 'string') {
            existingComments = JSON.parse(currentAction.comments)
          } else if (Array.isArray(currentAction.comments)) {
            existingComments = currentAction.comments
          }
        } catch {
          existingComments = []
        }

        // Add new comment
        existingComments.push(comment)

        // Update action with new comments
        const updateJson = await put(`/api/actions/${actionId}?tenant_id=${encodeURIComponent(tenant_id)}`, {
          comments: existingComments,
        })

        if (updateJson.error) {
          throw new Error(updateJson.error)
        }
      }

      showToast('Comment added successfully', 'success')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      showToast(`Failed to add comment: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Create Comment Dialog"
        className="relative w-[95%] max-w-2xl bg-white rounded-xl border border-[#DDE6D5] shadow-xl z-10"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE6D5]">
          <h2 className="text-xl font-semibold" style={{ color: THEME_COLORS.darkTeal }}>Add Comment</h2>
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
        <form onSubmit={onSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment
              </label>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Enter your comment..."
                rows={6}
                className="w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 transition-all"
                style={{
                  focusRingColor: THEME_COLORS.lightBlue,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = THEME_COLORS.lightBlue;
                  e.target.style.boxShadow = `0 0 0 2px ${THEME_COLORS.lightBlue}40`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
            </div>
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
              {saving ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

