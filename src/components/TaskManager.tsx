'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Edit, Trash2, Save, X, User, Clock, Calendar } from 'lucide-react'
import { TASK_CATEGORIES, getCategoryInfo, type TaskCategory } from '@/lib/categories'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  category: TaskCategory
  assignedTo?: {
    id: string
    name: string
    role: string
  }
  createdBy?: {
    id: string
    name: string
  }
  isRecurring: boolean
  daysOfWeek: string[]
  timePeriod?: string
  isActive: boolean
}

interface FamilyMember {
  id: string
  name: string
  email: string
  role: string
}

const TIME_PERIODS = {
  MORNING: { label: 'Morning (6 AM - 12 PM)', icon: '🌅' },
  AFTERNOON: { label: 'Afternoon (12 PM - 6 PM)', icon: '☀️' },
  EVENING: { label: 'Evening (6 PM - 10 PM)', icon: '🌙' },
  ANYTIME: { label: 'Anytime', icon: '⏰' }
}

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' }
]

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
    category: 'CHORES' as TaskCategory,
    assignedToId: '',
    isRecurring: false,
    daysOfWeek: [] as string[],
    timePeriod: 'ANYTIME'
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
        console.log('Fetched tasks:', data.tasks)
        setTasks(data.tasks)
      } else {
        console.error('Failed to fetch tasks:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch('/api/family')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched family members:', data.members)
        setFamilyMembers(data.members)
      } else {
        console.error('Failed to fetch family members:', response.status)
      }
    } catch (error) {
      console.error('Error fetching family members:', error)
    }
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      console.log('Submitting form data:', formData)
      
      const url = editingTask ? `/api/tasks/${editingTask}` : '/api/tasks'
      const method = editingTask ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      console.log('Response status:', response.status)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log('Success response:', responseData)
        await fetchTasks()
        resetForm()
        setError('')
      } else {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          errorData = { error: 'Unknown server error' }
        }
        console.error('API Error:', response.status, response.statusText, errorData)
        setError(errorData.error || `Failed to save task (${response.status}: ${response.statusText})`)
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
      category: task.category,
      assignedToId: task.assignedTo?.id || '',
      isRecurring: task.isRecurring,
      daysOfWeek: task.daysOfWeek,
      timePeriod: task.timePeriod || 'ANYTIME'
    })
    setShowAddForm(true)
    setError('')
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      points: 1,
      category: 'CHORES',
      assignedToId: '',
      isRecurring: false,
      daysOfWeek: [],
      timePeriod: 'ANYTIME'
    })
    setShowAddForm(false)
    setEditingTask(null)
    setError('')
  }

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    if (!acc[task.category]) {
      acc[task.category] = []
    }
    acc[task.category].push(task)
    return acc
  }, {} as Record<TaskCategory, Task[]>)

  // Get children for assignment
  const children = familyMembers.filter(member => member.role === 'CHILD')

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
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Manage Tasks</h2>
          <p className="text-sm text-gray-600">Family Members: {familyMembers.map(m => m.name).join(', ')}</p>
        </div>
            {!showAddForm && ( // Add this condition
            <button
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Add Task
            </button>
          )}
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
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as TaskCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                >
                  {Object.entries(TASK_CATEGORIES).map(([key, category]) => (
                    <option key={key} value={key}>
                      {category.icon} {category.label}
                    </option>
                  ))}
                </select>
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

            {/* Assignment and Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedToId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                >
                  <option value="">Everyone (no specific assignment)</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({child.role})
                    </option>
                  ))}
                </select>
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
            </div>

            {/* Scheduling Section */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                <Calendar size={16} />
                Task Schedule
              </h4>

              {/* Time Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When should this task be done?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(TIME_PERIODS).map(([key, period]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, timePeriod: key }))}
                      className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                        formData.timePeriod === key
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-lg mb-1">{period.icon}</div>
                      <div className="font-medium">{key.charAt(0) + key.slice(1).toLowerCase()}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    isRecurring: e.target.checked,
                    daysOfWeek: e.target.checked ? prev.daysOfWeek : []
                  }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                  Make this a recurring task
                </label>
              </div>

              {/* Days Selection (only show if recurring) */}
              {formData.isRecurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which days?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleDayToggle(value)}
                        className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                          formData.daysOfWeek.includes(value)
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {formData.isRecurring && formData.daysOfWeek.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      Select at least one day for recurring tasks
                    </p>
                  )}
                </div>
              )}
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

      {/* Tasks List - Grouped by Category */}
      <div className="space-y-6">
        {Object.entries(TASK_CATEGORIES).map(([categoryKey, categoryInfo]) => {
          const categoryTasks = tasksByCategory[categoryKey as TaskCategory] || []
          
          if (categoryTasks.length === 0) return null

          return (
            <div key={categoryKey} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">{categoryInfo.icon}</span>
                {categoryInfo.label}
                <span className="text-sm text-gray-500 ml-2">({categoryTasks.length})</span>
              </h3>
              
              <div className="space-y-3">
                {categoryTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${categoryInfo.bgColor} ${categoryInfo.borderColor}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-800">{task.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                          {categoryInfo.icon} {categoryInfo.label}
                        </span>
                        {task.timePeriod && task.timePeriod !== 'ANYTIME' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Clock size={10} />
                            {TIME_PERIODS[task.timePeriod as keyof typeof TIME_PERIODS]?.icon} {task.timePeriod.charAt(0) + task.timePeriod.slice(1).toLowerCase()}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-purple-600 font-medium">
                          {task.points} points
                        </span>
                        {task.assignedTo && (
                          <span className="text-blue-600 flex items-center gap-1">
                            <User size={12} />
                            For: {task.assignedTo.name}
                          </span>
                        )}
                        {task.isRecurring && task.daysOfWeek.length > 0 && (
                          <span className="text-green-600 flex items-center gap-1">
                            <Calendar size={12} />
                            {task.daysOfWeek.map(day => day.slice(0, 3)).join(', ')}
                          </span>
                        )}
                        {task.createdBy && (
                          <span className="text-gray-500">
                            Created by: {task.createdBy.name}
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
            </div>
          )
        })}

        {tasks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500">No tasks yet. Create your first task above!</p>
          </div>
        )}
      </div>
    </div>
  )
}