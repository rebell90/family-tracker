'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Trash2, Calendar, User, Award, AlertCircle, CheckCircle } from 'lucide-react'
import { getCategoryInfo, type TaskCategory } from '@/lib/categories'

interface TaskCompletion {
  id: string
  completedAt: string
  task: {
    id: string
    title: string
    points: number
    category: TaskCategory
  }
  user: {
    id: string
    name: string
  }
}

interface FamilyMember {
  id: string
  name: string
  role: string
}

interface Task {
  id: string
  title: string
}

export default function ManageCompletions() {
  const { data: session } = useSession()
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterTask, setFilterTask] = useState<string>('all')
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const user = session?.user as { role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  useEffect(() => {
    if (isParent) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [isParent])

  const fetchData = async () => {
    try {
      const [completionsRes, membersRes, tasksRes] = await Promise.all([
        fetch('/api/tasks/completions'),
        fetch('/api/family'),
        fetch('/api/tasks/all-children')
      ])

      if (completionsRes.ok) {
        const data = await completionsRes.json()
        setCompletions(data.completions || [])
      }

      if (membersRes.ok) {
        const data = await membersRes.json()
        setFamilyMembers(data.members || [])
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (completionId: string, taskTitle: string) => {
    if (!confirm(`Delete this completion of "${taskTitle}"? Points will be refunded.`)) {
      return
    }

    setDeleting(completionId)
    try {
      const response = await fetch(`/api/tasks/completions/${completionId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setCompletions(prev => prev.filter(c => c.id !== completionId))
      } else {
        alert(data.error || 'Failed to delete completion')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete completion')
    } finally {
      setDeleting(null)
    }
  }

  const filteredCompletions = completions.filter(completion => {
    if (filterUser !== 'all' && completion.user.id !== filterUser) return false
    if (filterTask !== 'all' && completion.task.id !== filterTask) return false
    return true
  })

  const groupedByDate = filteredCompletions.reduce((acc, completion) => {
    const date = new Date(completion.completedAt).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(completion)
    return acc
  }, {} as Record<string, TaskCompletion[]>)

  if (!isParent) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-yellow-600" size={40} />
        <h3 className="text-base sm:text-lg font-semibold text-yellow-900 mb-2">
          Parent Access Only
        </h3>
        <p className="text-sm sm:text-base text-yellow-700">
          Only parents can manage and delete task completions.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8 sm:py-12">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm sm:text-base text-gray-600 mt-4">Loading completions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          Manage Task Completions
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          View and delete completed task instances. Points will be refunded when deleted.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="font-semibold text-gray-800 mb-4 text-base sm:text-lg">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by User
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-base"
            >
              <option value="all">All Users</option>
              {familyMembers
              .filter(member => member.role === 'CHILD') 
              .map(member => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
          </div>

          {/* Task Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Task
            </label>
            <select
              value={filterTask}
              onChange={(e) => setFilterTask(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-base"
            >
              <option value="all">All Tasks</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-xs sm:text-sm text-gray-600">
          Showing {filteredCompletions.length} of {completions.length} completions
        </div>
      </div>

      {/* Completions List - TASK CARD STYLE! */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
          <Calendar className="mx-auto mb-4 text-gray-400" size={40} />
          <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">
            No completions found
          </h3>
          <p className="text-sm sm:text-base text-gray-600">
            No task completions match your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, dayCompletions]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="text-gray-400" size={20} />
                  <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{date}</h3>
                  <span className="text-sm text-gray-500">({dayCompletions.length} completions)</span>
                </div>

                {/* Task Cards */}
                <div className="space-y-3">
                  {dayCompletions.map(completion => {
                    const categoryInfo = getCategoryInfo(completion.task.category)
                    
                    return (
                      <div
                        key={completion.id}
                        className="bg-white rounded-xl shadow-sm border-2 border-green-200 p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkmark Icon */}
                          <div className="w-10 h-10 rounded-full bg-green-500 border-3 border-green-500 flex items-center justify-center shrink-0">
                            <CheckCircle size={20} className="text-white" />
                          </div>

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <h4 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base break-words">
                              {completion.task.title}
                            </h4>

                            {/* Metadata Row */}
                            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <User size={14} className="shrink-0" />
                                <span className="font-medium">{completion.user.name}</span>
                              </div>
                              <span className="text-gray-300">•</span>
                              <div className="flex items-center gap-1">
                                <Award size={14} className="shrink-0 text-yellow-600" />
                                <span className="font-medium text-yellow-700">{completion.task.points} pts</span>
                              </div>
                              <span className="text-gray-300">•</span>
                              <div className="flex items-center gap-1">
                                <Calendar size={14} className="shrink-0" />
                                <span>
                                  {new Date(completion.completedAt).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Category Badge */}
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${categoryInfo.color}`}>
                                <span>{categoryInfo.icon}</span>
                                <span>{categoryInfo.label}</span>
                              </span>
                            </div>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(completion.id, completion.task.title)}
                            disabled={deleting === completion.id}
                            className="shrink-0 p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 border border-red-200 hover:border-red-300"
                            title="Delete completion and refund points"
                          >
                            {deleting === completion.id ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                            ) : (
                              <Trash2 size={20} />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}