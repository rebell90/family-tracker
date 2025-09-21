'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, CheckCircle, Plus, Gift } from 'lucide-react'

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
  const [showAddTask, setShowAddTask] = useState(false)

  const isParent = session?.user?.role === 'PARENT'
  const isChild = session?.user?.role === 'CHILD'

  // Mock data for now - we'll replace with real API calls later
  useEffect(() => {
    setTasks([
      { id: '1', title: 'Make bed', points: 5, completed: false, completedToday: false },
      { id: '2', title: 'Feed pets', points: 3, completed: true, completedToday: true },
      { id: '3', title: 'Homework complete', points: 10, completed: false, completedToday: false },
      { id: '4', title: 'Clean room', points: 8, completed: false, completedToday: false },
    ])

    setStats({
      currentPoints: 47,
      totalEarned: 156,
      tasksCompletedToday: 1,
      streak: 3
    })
  }, [])

  const completeTask = async (taskId: string) => {
    // This will be an API call later
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, completed: true, completedToday: true }
        : task
    ))
    
    // Update points
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      setStats(prev => ({
        ...prev,
        currentPoints: prev.currentPoints + task.points,
        totalEarned: prev.totalEarned + task.points,
        tasksCompletedToday: prev.tasksCompletedToday + 1
      }))
    }
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
            <button
              onClick={() => setShowAddTask(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={20} />
              Add Task
            </button>
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
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  task.completed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => !task.completed && completeTask(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-purple-500'
                    }`}
                    disabled={task.completed}
                  >
                    {task.completed && <CheckCircle size={16} />}
                  </button>
                  <div>
                    <h3 className={`font-medium ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-800'
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
                    task.completed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {task.points} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions for Parents */}
        {isParent && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                <h3 className="font-medium text-gray-800">Add New Reward</h3>
                <p className="text-sm text-gray-600 mt-1">Create something to work towards</p>
              </button>
              <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                <h3 className="font-medium text-gray-800">View Progress</h3>
                <p className="text-sm text-gray-600 mt-1">See detailed analytics</p>
              </button>
              <button className="p-4 text-left rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                <h3 className="font-medium text-gray-800">Family Settings</h3>
                <p className="text-sm text-gray-600 mt-1">Manage users and preferences</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}