'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Edit, Trash2, Save, X, User, Clock, Calendar } from 'lucide-react'
import { TASK_CATEGORIES, getCategoryInfo, type TaskCategory } from '@/lib/categories'
import Modal from './Modal'

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
  startDate: string
  isActive: boolean
  recurringEndDate?: string | null
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
    timePeriod: 'ANYTIME',
    hasEndDate: false,
    recurringEndDate: '',
    startDate: new Date().toISOString().split('T')[0],
  })

  const user = session?.user as { name?: string; role?: string } | undefined
  const isParent = user?.role === 'PARENT'

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
      
      const submitData = {
        ...formData,
        recurringEndDate: formData.hasEndDate && formData.recurringEndDate 
          ? new Date(formData.recurringEndDate).toISOString() 
          : null
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
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
      timePeriod: task.timePeriod || 'ANYTIME',
      hasEndDate: !!task.recurringEndDate,
      recurringEndDate: task.recurringEndDate ? task.recurringEndDate.split('T')[0] : '',
      startDate: task.startDate 
      ? new Date(task.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    })
    console.log('Form data set, showing form')
    setShowAddForm(true)
    console.log('showAddForm should now be true')
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
      timePeriod: 'ANYTIME',
      hasEndDate: false,
      recurringEndDate: '',
      startDate: new Date().toISOString().split('T')[0],
    })
    setShowAddForm(false)
    setEditingTask(null)
    setError('')
  }

  const getEndDateStatus = (endDate: string | null | undefined) => {
    if (!endDate) return null
    
    const end = new Date(endDate)
    const now = new Date()
    const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysRemaining < 0) {
      return { text: 'Expired', color: 'bg-gray-100 text-gray-600', icon: '⏰' }
    }
    if (daysRemaining === 0) {
      return { text: 'Last day!', color: 'bg-orange-100 text-orange-700', icon: '⚠️' }
    }
    if (daysRemaining <= 3) {
      return { text: `${daysRemaining} days left`, color: 'bg-orange-100 text-orange-700', icon: '⚠️' }
    }
    if (daysRemaining <= 7) {
      return { text: `${daysRemaining} days left`, color: 'bg-yellow-100 text-yellow-700', icon: '📅' }
    }
    return { text: `Ends ${end.toLocaleDateString()}`, color: 'bg-blue-100 text-blue-700', icon: '📅' }
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header - MOBILE RESPONSIVE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Manage Tasks</h2>
          <p className="text-xs sm:text-sm text-gray-600 truncate">
            Family Members: {familyMembers.map(m => m.name).join(', ')}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
          >
            <Plus size={18} />
            Add Task
          </button>
        )}
      </div>

      {/* Add/Edit Form - NOW IN MODAL */}
      {showAddForm && (<Modal
        isOpen={showAddForm}
        onClose={resetForm}
        title={editingTask ? 'Edit Task' : 'Add New Task'}
        size="lg"
      >
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info - MOBILE RESPONSIVE: Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500 text-base"
                  placeholder="e.g., Make bed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as TaskCategory }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white text-base"
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
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white text-base"
                />
              </div>
            </div>

            {/* Assignment and Description - MOBILE RESPONSIVE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedToId: e.target.value }))}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white text-base"
                >
                  <option value="">Everyone</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.name}
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
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500 text-base"
                  rows={2}
                  placeholder="Optional..."
                />
              </div>
            </div>

            {/* Scheduling Section - MOBILE RESPONSIVE */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                <Calendar size={16} />
                Task Schedule
              </h4>

              {/* Time Period - MOBILE RESPONSIVE: 2 columns on mobile, 4 on desktop */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When should this task be done?
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {Object.entries(TIME_PERIODS).map(([key, period]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, timePeriod: key }))}
                      className={`p-2 sm:p-3 text-xs sm:text-sm rounded-lg border-2 transition-colors ${
                        formData.timePeriod === key
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-base sm:text-lg mb-1">{period.icon}</div>
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
                    daysOfWeek: e.target.checked ? prev.daysOfWeek : [],
                    hasEndDate: e.target.checked ? prev.hasEndDate : false,
                    recurringEndDate: e.target.checked ? prev.recurringEndDate : ''
                  }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                  Make this a recurring task
                </label>
              </div>

              {/* Days Selection - MOBILE RESPONSIVE: Wrap properly */}
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
                    <p className="text-xs sm:text-sm text-orange-600 mt-1">
                      Select at least one day for recurring tasks
                    </p>
                  )}
                </div>
              )}
                {/* Start Date Selection - ADD THE CONDITIONAL HERE */}
            {formData.isRecurring && (
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📅 Task will only appear on/after this date
                </p>
              </div>
            )}
              {/* End Date Section - MOBILE RESPONSIVE */}
              {formData.isRecurring && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasEndDate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hasEndDate: e.target.checked,
                        recurringEndDate: e.target.checked ? prev.recurringEndDate : ''
                      }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="font-medium text-gray-700 text-sm sm:text-base">
                      Set an end date for this recurring task
                    </span>
                  </label>

                  {formData.hasEndDate && (
                    <div className="ml-0 sm:ml-6 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Last day this task should occur
                      </label>
                      <input
                        type="date"
                        value={formData.recurringEndDate}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          recurringEndDate: e.target.value
                        }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        style={{ color: '#1f2937', fontWeight: '500' }}
                        required={formData.hasEndDate}
                      />
                      <p className="text-xs text-gray-600">
                        💡 After this date, the task will automatically stop appearing
                      </p>
                      <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 sm:px-3 py-2 rounded">
                        <strong>Example uses:</strong> &quot;Take medicine for 2 weeks&quot; or &quot;Practice piano until recital&quot;
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Form Actions - MOBILE RESPONSIVE: Stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Save size={16} />
                {editingTask ? 'Update Task' : 'Create Task'}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tasks List - MOBILE RESPONSIVE */}
      <div className="space-y-4 sm:space-y-6">
        {Object.entries(TASK_CATEGORIES).map(([categoryKey, categoryInfo]) => {
          const categoryTasks = tasksByCategory[categoryKey as TaskCategory] || []
          
          if (categoryTasks.length === 0) return null

          return (
            <div key={categoryKey} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl">{categoryInfo.icon}</span>
                <span className="truncate">{categoryInfo.label}</span>
                <span className="text-xs sm:text-sm text-gray-500 ml-auto">({categoryTasks.length})</span>
              </h3>
              
              <div className="space-y-3">
                {categoryTasks.map((task) => {
                  const endStatus = getEndDateStatus(task.recurringEndDate)
                  
                  return (
                    <div
                      key={task.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-lg border-2 transition-colors ${categoryInfo.bgColor} ${categoryInfo.borderColor}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                          <h4 className="font-medium text-gray-800 text-sm sm:text-base break-words">{task.title}</h4>
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${categoryInfo.color} shrink-0`}>
                            {categoryInfo.icon} <span className="hidden sm:inline">{categoryInfo.label}</span>
                          </span>
                          {task.timePeriod && task.timePeriod !== 'ANYTIME' && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1 shrink-0">
                              <Clock size={10} />
                              <span className="hidden sm:inline">{TIME_PERIODS[task.timePeriod as keyof typeof TIME_PERIODS]?.icon}</span>
                              <span className="hidden md:inline">{task.timePeriod.charAt(0) + task.timePeriod.slice(1).toLowerCase()}</span>
                            </span>
                          )}
                          {endStatus && (
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 ${endStatus.color}`}>
                              <span className="hidden sm:inline">{endStatus.icon}</span> {endStatus.text}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                          <span className="text-purple-600 font-medium whitespace-nowrap">
                            {task.points} points
                          </span>
                          {task.assignedTo && (
                            <span className="text-blue-600 flex items-center gap-1">
                              <User size={12} />
                              <span className="truncate max-w-[150px]">{task.assignedTo.name}</span>
                            </span>
                          )}
                          {task.isRecurring && task.daysOfWeek.length > 0 && (
                            <span className="text-green-600 flex items-center gap-1">
                              <Calendar size={12} />
                              <span className="hidden sm:inline">{task.daysOfWeek.map(day => day.slice(0, 3)).join(', ')}</span>
                              <span className="sm:hidden">{task.daysOfWeek.length} days</span>
                            </span>
                          )}
                          {task.createdBy && (
                            <span className="text-gray-500 hidden md:inline">
                              Created by: {task.createdBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 sm:ml-auto shrink-0">
                        <button
                          onClick={() => startEdit(task)}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          aria-label="Edit task"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label="Delete task"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {tasks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base text-gray-500">No tasks yet. Create your first task above!</p>
          </div>
        )}
      </div>
    </div>
  )
}