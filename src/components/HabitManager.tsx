'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Target, Plus, Edit2, Trash2, Clock, BookOpen, Dumbbell, Droplet, TrendingUp } from 'lucide-react'
import Modal from './Modal'

interface Habit {
  id: string
  title: string
  description?: string
  measurementType: string
  measurementUnit?: string
  goalAmount: number
  pointsPerGoal?: number
  icon?: string
  color?: string
  frequency: string
  daysOfWeek: string[]
  assignedTo?: {
    id: string
    name: string
    role: string
  }
  createdBy: {
    id: string
    name: string
  }
  isActive: boolean
}

interface FamilyMember {
  id: string
  name: string
  email: string
  role: string
}

const MEASUREMENT_TYPES = [
  { value: 'MINUTES', label: 'Minutes', icon: '⏱️', examples: 'Reading, practice, exercise' },
  { value: 'PAGES', label: 'Pages', icon: '📖', examples: 'Books, worksheets' },
  { value: 'REPS', label: 'Reps/Problems', icon: '💪', examples: 'Push-ups, math problems' },
  { value: 'DISTANCE', label: 'Distance', icon: '🏃', examples: 'Running, walking' },
  { value: 'COUNT', label: 'Count', icon: '🔢', examples: 'Glasses of water, servings' }
]

const HABIT_TEMPLATES = [
  { title: 'Reading Time', type: 'MINUTES', unit: 'minutes', goal: 30, icon: '📚', color: 'text-blue-600' },
  { title: 'Math Practice', type: 'REPS', unit: 'problems', goal: 20, icon: '➕', color: 'text-purple-600' },
  { title: 'Exercise', type: 'MINUTES', unit: 'minutes', goal: 15, icon: '💪', color: 'text-green-600' },
  { title: 'Drink Water', type: 'COUNT', unit: 'glasses', goal: 8, icon: '💧', color: 'text-blue-400' },
  { title: 'Piano Practice', type: 'MINUTES', unit: 'minutes', goal: 20, icon: '🎹', color: 'text-pink-600' },
]

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' }
]

export default function HabitManager() {
  const { data: session } = useSession()
  const [habits, setHabits] = useState<Habit[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    measurementType: 'MINUTES',
    measurementUnit: '',
    goalAmount: 30,
    assignedToId: '',
    frequency: 'DAILY',
    daysOfWeek: [] as string[],
    pointsPerGoal: 10,
    icon: '🎯',
    color: ''
  })

  const user = session?.user as { name?: string; role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  useEffect(() => {
    if (isParent) {
      fetchHabits()
      fetchFamilyMembers()
    }
  }, [isParent])

  const fetchHabits = async () => {
    try {
      const response = await fetch('/api/habits')
      if (response.ok) {
        const data = await response.json()
        setHabits(data.habits)
      }
    } catch (error) {
      console.error('Error fetching habits:', error)
    }
  }

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch('/api/family')
      if (response.ok) {
        const data = await response.json()
        setFamilyMembers(data.members)
      }
    } catch (error) {
      console.error('Error fetching family members:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const url = editingHabit ? `/api/habits/${editingHabit.id}` : '/api/habits'
      const method = editingHabit ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchHabits()
        resetForm()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save habit')
      }
    } catch (error) {
      console.error('Error saving habit:', error)
      setError('Network error occurred. Please try again.')
    }
  }

  const deleteHabit = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit?')) return
    
    try {
      const response = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchHabits()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete habit')
      }
    } catch (error) {
      console.error('Error deleting habit:', error)
      setError('Network error occurred. Please try again.')
    }
  }

  const startEdit = (habit: Habit) => {
    setEditingHabit(habit)
    setFormData({
      title: habit.title,
      description: habit.description || '',
      measurementType: habit.measurementType,
      measurementUnit: habit.measurementUnit || '',
      goalAmount: habit.goalAmount,
      assignedToId: habit.assignedTo?.id || '',
      frequency: habit.frequency,
      daysOfWeek: habit.daysOfWeek,
      pointsPerGoal: habit.pointsPerGoal || 0,
      icon: habit.icon || '🎯',
      color: habit.color || ''
    })
    setShowCreateForm(true)
  }

  const applyTemplate = (template: typeof HABIT_TEMPLATES[0]) => {
    setFormData(prev => ({
      ...prev,
      title: template.title,
      measurementType: template.type,
      measurementUnit: template.unit,
      goalAmount: template.goal,
      icon: template.icon,
      color: template.color
    }))
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      measurementType: 'MINUTES',
      measurementUnit: '',
      goalAmount: 30,
      assignedToId: '',
      frequency: 'DAILY',
      daysOfWeek: [],
      pointsPerGoal: 10,
      icon: '🎯',
      color: ''
    })
    setShowCreateForm(false)
    setEditingHabit(null)
    setError('')
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  const children = familyMembers.filter(member => member.role === 'CHILD')

  if (!isParent) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Only parents can manage habits.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Manage Habits</h2>
          <p className="text-sm text-gray-600">Create and track healthy habits for your family</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add Habit
          </button>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={resetForm}
        title={editingHabit ? 'Edit Habit' : 'Create New Habit'}
        size="lg"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Templates */}
          {!editingHabit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Start Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HABIT_TEMPLATES.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="p-3 text-left border-2 border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                  >
                    <div className="text-2xl mb-1">{template.icon}</div>
                    <div className="text-xs font-medium text-gray-800">{template.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Habit Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                placeholder="e.g., Reading Time"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                rows={2}
                placeholder="What should they do?"
              />
            </div>
          </div>

          {/* Measurement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How to Measure?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MEASUREMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    measurementType: type.value,
                    measurementUnit: type.value === 'MINUTES' ? 'minutes' : 
                                     type.value === 'PAGES' ? 'pages' :
                                     type.value === 'REPS' ? 'reps' : 
                                     type.value === 'DISTANCE' ? 'miles' : 'times'
                  }))}
                  className={`p-3 text-left border-2 rounded-lg transition-colors ${
                    formData.measurementType === type.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                  <p className="text-xs text-gray-600">{type.examples}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Goal and Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Goal Amount *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.goalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, goalAmount: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Label (optional)
              </label>
              <input
                type="text"
                value={formData.measurementUnit}
                onChange={(e) => setFormData(prev => ({ ...prev, measurementUnit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                placeholder="e.g., pages, problems, glasses"
              />
            </div>
          </div>

          {/* Assignment and Points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to
              </label>
              <select
                value={formData.assignedToId}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedToId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
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
                Points for Completing Goal
              </label>
              <input
                type="number"
                min="0"
                value={formData.pointsPerGoal}
                onChange={(e) => setFormData(prev => ({ ...prev, pointsPerGoal: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                placeholder="0 for no points"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How Often?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, frequency: 'DAILY', daysOfWeek: [] }))}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  formData.frequency === 'DAILY'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Every Day
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, frequency: 'CUSTOM' }))}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  formData.frequency === 'CUSTOM'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Specific Days
              </button>
            </div>
          </div>

          {/* Days Selection */}
          {formData.frequency === 'CUSTOM' && (
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
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {editingHabit ? 'Update Habit' : 'Create Habit'}
            </button>
            
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Habits List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {habits.map((habit) => (
          <div key={habit.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className={`text-3xl ${habit.color || ''}`}>
                  {habit.icon || '🎯'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{habit.title}</h3>
                  {habit.description && (
                    <p className="text-sm text-gray-600 mt-1">{habit.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Target size={14} />
                <span>Goal: {habit.goalAmount} {habit.measurementUnit || ''}/day</span>
              </div>
              {habit.pointsPerGoal && (
                <div className="flex items-center gap-2">
                  <span>⭐</span>
                  <span>{habit.pointsPerGoal} points per goal</span>
                </div>
              )}
              {habit.assignedTo && (
                <div className="text-blue-600">
                  For: {habit.assignedTo.name}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => startEdit(habit)}
                className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={() => deleteHabit(habit.id)}
                className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {habits.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No habits yet. Create your first habit above!</p>
        </div>
      )}
    </div>
  )
}