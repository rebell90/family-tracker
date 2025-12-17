'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Trash2, Calendar, User, Award, AlertCircle } from 'lucide-react'

interface TaskCompletion {
  id: string
  completedAt: string
  task: {
    id: string
    title: string
    points: number
    category: string
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
      {/* Header - MOBILE RESPONSIVE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          Manage Task Completions
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          View and delete completed task instances. Points will be refunded when deleted.
        </p>
      </div>

      {/* Filters - MOBILE RESPONSIVE */}
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

      {/* Completions List - MOBILE RESPONSIVE */}
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
        <div className="space-y-3 sm:space-y-4">
          {Object.entries(groupedByDate)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, dayCompletions]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Date Header - MOBILE RESPONSIVE */}
                <div className="bg-gray-50 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{date}</h3>
                  <p className="text-xs sm:text-sm text-gray-600">{dayCompletions.length} completions</p>
                </div>

                {/* Completions - MOBILE RESPONSIVE */}
                <div className="divide-y divide-gray-100">
                  {dayCompletions.map(completion => (
                    <div
                      key={completion.id}
                      className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Task Title - MOBILE RESPONSIVE */}
                          <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base break-words">
                            {completion.task.title}
                          </h4>

                          {/* Metadata - MOBILE RESPONSIVE: Stack on mobile */}
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <User size={12} className="sm:w-[14px] sm:h-[14px] shrink-0" />
                              <span className="truncate">{completion.user.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Award size={12} className="sm:w-[14px] sm:h-[14px] shrink-0" />
                              <span>{completion.task.points} points</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar size={12} className="sm:w-[14px] sm:h-[14px] shrink-0" />
                              <span className="truncate">
                                {new Date(completion.completedAt).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Category Badge - MOBILE RESPONSIVE */}
                          <span className="inline-block mt-2 px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {completion.task.category}
                          </span>
                        </div>

                        {/* Delete Button - MOBILE RESPONSIVE */}
                        <button
                          onClick={() => handleDelete(completion.id, completion.task.title)}
                          disabled={deleting === completion.id}
                          className="self-center shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete completion and refund points"
                        >
                          {deleting === completion.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                          ) : (
                            <Trash2 size={18} className="sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}