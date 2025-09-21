'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  assignedTo?: {
    id: string
    name: string
    role: string
  }
  isRecurring: boolean
  daysOfWeek: string[]
  isActive: boolean
}

interface FamilyMember {
  id: string
  name: string
  role: string
}

export default function TaskManager() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 1,
    assignedToId: '',
    isRecurring: false,
    daysOfWeek: []
  })

  const isParent = session?.user?.role === 'PARENT'

  useEffect(() => {
    if (isParent) {
      fetchTasks()
      fetchFamilyMembers()
    }
  }, [isParent])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks)
      } else {
        console.error('Failed to fetch tasks:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchFamilyMembers = async () => {
    // For now, we'll use mock data. In a real app, you'd fetch from an API
    setFamilyMembers([
      { id: session?.user?.id || '', name: 'Me (Parent)', role: 'PARENT' },
      // We'll add a way to get actual family members later
    ])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      console.log('Submitting form data:', formData) // Debug log
      
      const url = editingTask ? `/api/tasks/${editingTask}` : '/api/tasks'
      const method = editingTask ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      console.log('Response status:', response.status) // Debug log
      
      if (response.ok) {
        fetchTasks()
        resetForm()
        setError('')
      } else {
        // Get the actual error message from the server
        const errorData = await response.json()
        console.error('API Error:', response.status, errorData)
        setError(errorData.error || `Failed to save task (${response.status})`)
      }
    } catch (error) {
      console.error('Network error:', error)
      setError('Network error occurred. Please try again.')
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTasks()
      } else {
        const errorData = await response.json()
        console.error('Delete error:', errorData)
        setError(errorData.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      setError('Network error occurred. Please try again.')
    }
  }

  const startEdit = (task: Task) => {
    setEditingTask(task.id)
    setFormData({
      title: task.title,
      description: task.description || '',
      points: task.points,
      assignedToId: task.assignedTo?.id || '',
      isRecurring: task.isRecurring,
      daysOfWeek: task.daysOfWeek
    })
    setShowAddForm(true)
    setError('')
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      points: 1,
      assignedToId: '',
      isRecurring: false,
      daysOfWeek: []
    })
    setShowAddForm(false)
    setEditingTask(null)
    setError('')
  }

  if (!isParent) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Only parents can manage tasks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Manage Tasks</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Task
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingTask ? 'Edit Task' : 'Add New Task'}
          </h3>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500"
                  placeholder="e.g., Make bed, Do homework"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Points
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.points}
                  onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500"
                rows={2}
                placeholder="Optional description..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                {editingTask ? 'Update Task' : 'Create Task'}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Tasks</h3>
        
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tasks yet. Create your first task above!
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-purple-600 font-medium">
                      {task.points} points
                    </span>
                    {task.assignedTo && (
                      <span className="text-sm text-gray-500">
                        Assigned to: {task.assignedTo.name}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(task)}
                    className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
