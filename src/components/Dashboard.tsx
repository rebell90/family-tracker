'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Plus, Gift, Settings, Users } from 'lucide-react'
import TaskManager from './TaskManager'
import FamilyManager from './FamilyManager'

interface Task {
  id: string
  title: string
  description?: string
  points: number
  completed: boolean
  completedToday: boolean
}

interface UserStats {
  currentPoints: number
  totalEarned: number
  tasksCompletedToday: number
  streak: number
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<UserStats>({
    currentPoints: 0,
    totalEarned: 0,
    tasksCompletedToday: 0,
    streak: 0
  })
  const [showTaskManager, setShowTaskManager] = useState(false)
  const [showFamilyManager, setShowFamilyManager] = useState(false)

  const isParent = session?.user?.role === 'PARENT'
  const isChild = session?.user?.role === 'CHILD'

  // Mock data for now - we'll replace with real API calls later
useEffect(() => {
  fetchTasks()
  fetchUserPoints()
}, [])

    // Add this state for loading
const [completingTask, setCompletingTask] = useState<string | null>(null)

// Add this function near your other functions
const fetchTasks = async () => {
  try {
    const response = await fetch('/api/tasks')
    if (response.ok) {
      const data = await response.json()
      // The API should return tasks with their completion status
      setTasks(data.tasks || [])
    }
  } catch (error) {
    console.error('Error fetching tasks:', error)
  }
}

const fetchUserPoints = async () => {
  try {
    const response = await fetch('/api/user/points')
    if (response.ok) {
      const data = await response.json()
      setStats(prev => ({
        ...prev,
        currentPoints: data.currentPoints,
        totalEarned: data.totalEarned
      }))
    }
  } catch (error) {
    console.error('Error fetching points:', error)
  }
}

// Add this function for completing tasks
const handleCompleteTask = async (taskId: string) => {
  setCompletingTask(taskId)
  
  try {
    const response = await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    })

    const data = await response.json()

    if (response.ok) {
      // Show success message
      alert(data.message) // We can make this prettier later
      
      // Refresh tasks and user data
      fetchTasks()
      fetchUserPoints()
    } else {
      alert(data.error)
    }
  } catch (error) {
    console.error('Error completing task:', error)
    alert('Failed to complete task')
  } finally {
    setCompletingTask(null)
  }
}

  // If parent is viewing task manager, show that instead
  if (isParent && showTaskManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Task Manager</h1>
            <button
              onClick={() => setShowTaskManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <TaskManager />
        </div>
      </div>
    )
  }

  // If parent is viewing family manager, show that instead
  if (isParent && showFamilyManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Family Manager</h1>
            <button
              onClick={() => setShowFamilyManager(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          <FamilyManager />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Hi {session?.user?.name || 'there'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              {isChild ? "Let's see what you can accomplish today!" : "Family Dashboard"}
            </p>
          </div>
          {isParent && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowFamilyManager(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Users size={20} />
                Family
              </button>
              <button
                onClick={() => setShowTaskManager(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Settings size={20} />
                Tasks
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Star className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Points</p>
                <p className="text-2xl font-bold text-gray-800">{stats.currentPoints}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tasks Today</p>
                <p className="text-2xl font-bold text-gray-800">{stats.tasksCompletedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Gift className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Earned</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalEarned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <span className="text-orange-600 text-xl">🔥</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Streak Days</p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
              </div>
            </div>
          </div>
        </div>

{/* Tasks Section */}
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
  <h2 className="text-xl font-semibold text-gray-800 mb-4">
    {isChild ? "Your Tasks" : "Family Tasks"}
  </h2>
  
  <div className="space-y-3">
    {tasks.map((task) => {
      const isCompleted = task.completedToday || task.completed
      
      return (
        <div
          key={task.id}
          className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
            isCompleted
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                isCompleted
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300'
              }`}
            >
              {isCompleted && <CheckCircle size={16} />}
            </div>
            
            <div>
              <h3 className={`font-medium ${
                isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'
              }`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-gray-600">{task.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isCompleted
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {task.points} pts
            </span>
            
            {!isCompleted ? (
              <button
                onClick={() => handleCompleteTask(task.id)}
                disabled={completingTask === task.id}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                {completingTask === task.id ? 'Working...' : 'Complete'}
              </button>
            ) : (
              <span className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-medium">
                Done!
              </span>
            )}
          </div>
        </div>
      )
    })}
  </div>
</div>

        {/* Quick Actions for Parents */}
        {isParent && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={() => setShowFamilyManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Family</h3>
                <p className="text-sm text-gray-600 mt-1">Invite family members and manage accounts</p>
              </button>
              <button 
                onClick={() => setShowTaskManager(true)}
                className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <h3 className="font-medium text-gray-800">Manage Tasks</h3>
                <p className="text-sm text-gray-600 mt-1">Add, edit, or remove family tasks</p>
              </button>
              <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                <h3 className="font-medium text-gray-800">Add New Reward</h3>
                <p className="text-sm text-gray-600 mt-1">Create something to work towards</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}