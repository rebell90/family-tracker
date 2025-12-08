'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import { Calendar, Trash2, Loader2 } from 'lucide-react'

interface DeleteTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: {
    id: string
    title: string
    points: number
    isRecurring: boolean
  } | null
  onConfirm: (action: 'end' | 'delete') => Promise<void>
}

export default function DeleteTaskModal({ isOpen, onClose, task, onConfirm }: DeleteTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ completionCount: number; totalPoints: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskStats()
    }
  }, [isOpen, task])

  const fetchTaskStats = async () => {
    if (!task) return
    
    setLoadingStats(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching task stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleAction = async (action: 'end' | 'delete') => {
    if (!task) return
    
    // Extra confirmation for delete forever
    if (action === 'delete') {
      const confirmed = window.confirm(
        `⚠️ WARNING: This will permanently delete "${task.title}" and remove ALL history and points earned from this task. This CANNOT be undone!\n\nAre you absolutely sure?`
      )
      if (!confirmed) return
    }

    setLoading(true)
    try {
      await onConfirm(action)
      onClose()
    } catch (error) {
      console.error('Error handling task action:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!task) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What would you like to do?"
      size="md"
    >
      <div className="space-y-6">
        {/* Task Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">{task.title}</h3>
          {loadingStats ? (
            <p className="text-sm text-gray-600">Loading history...</p>
          ) : stats ? (
            <p className="text-sm text-gray-600">
              {stats.completionCount > 0 ? (
                <>
                  This task has been completed <strong>{stats.completionCount}</strong> time
                  {stats.completionCount !== 1 ? 's' : ''} for a total of{' '}
                  <strong className="text-purple-600">{stats.totalPoints}</strong> points.
                </>
              ) : (
                'This task has never been completed.'
              )}
            </p>
          ) : null}
        </div>

        {/* Option 1: End Task */}
        {task.isRecurring && (
          <button
            onClick={() => handleAction('end')}
            disabled={loading}
            className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 p-4 rounded-lg text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <Calendar className="text-blue-600" size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  End Task Now
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </h4>
                <p className="text-sm text-gray-600">
                  Stop showing this task from today onwards, but <strong>keep all completion history and points</strong>.
                  Perfect for tasks that are no longer needed.
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Option 2: Delete Forever */}
        <button
          onClick={() => handleAction('delete')}
          disabled={loading}
          className="w-full bg-red-50 hover:bg-red-100 border-2 border-red-200 p-4 rounded-lg text-left transition-colors disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg shrink-0">
              <Trash2 className="text-red-600" size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                Delete Forever
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Dangerous
                </span>
              </h4>
              <p className="text-sm text-gray-600">
                <strong className="text-red-600">Permanently delete</strong> this task AND remove all history.
                {stats && stats.completionCount > 0 && (
                  <> This will remove <strong>{stats.totalPoints}</strong> points from history.</>
                )}
                {' '}Cannot be undone!
              </p>
            </div>
          </div>
        </button>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              Processing...
            </span>
          ) : (
            'Cancel'
          )}
        </button>
      </div>
    </Modal>
  )
}