'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { TrendingUp, TrendingDown, Award, CheckCircle, Target, Calendar, Users, Star } from 'lucide-react'
import Link from 'next/link'

interface ChildStats {
  id: string
  name: string | null
  currentPoints: number
  totalEarned: number
  thisWeek: {
    tasksCompleted: number
    pointsEarned: number
    rewardsRedeemed: number
  }
  lastWeek: {
    tasksCompleted: number
    pointsEarned: number
  }
  improvement: {
    tasks: number
    points: number
  }
}

interface TaskStats {
  id: string
  title: string
  assignedTo: string
  category: string
  points: number
  completionsThisWeek: number
  isRecurring: boolean
}

interface FamilyTotals {
  thisWeek: {
    tasksCompleted: number
    pointsEarned: number
    rewardsRedeemed: number
  }
  lastWeek: {
    tasksCompleted: number
    pointsEarned: number
  }
}

interface DailyData {
  date: string
  tasks: number
  points: number
}

interface ReportData {
  familyTotals: FamilyTotals
  childrenStats: ChildStats[]
  taskStats: TaskStats[]
  dailyBreakdown: DailyData[]
  weekRange: {
    start: string
    end: string
  }
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const user = session?.user as { role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  useEffect(() => {
    if (session) {
      fetchReportData()
    }
  }, [session])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports/weekly')
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isParent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Restricted</h2>
            <p className="text-gray-600 mb-6">Only parents can view progress reports.</p>
            <Link href="/dashboard" className="text-purple-600 hover:text-purple-700 underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading report...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No Data Yet</h2>
            <p className="text-gray-600 mb-6">Start completing tasks to see progress reports!</p>
            <Link href="/dashboard" className="text-purple-600 hover:text-purple-700 underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { familyTotals, childrenStats, taskStats, dailyBreakdown, weekRange } = reportData
  
  const weekStart = new Date(weekRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekEnd = new Date(weekRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const taskImprovement = familyTotals.thisWeek.tasksCompleted - familyTotals.lastWeek.tasksCompleted
  const pointsImprovement = familyTotals.thisWeek.pointsEarned - familyTotals.lastWeek.pointsEarned

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Weekly Progress Report</h1>
            <p className="text-gray-600 mt-1">
              {weekStart} - {weekEnd}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Family Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasks Completed</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {familyTotals.thisWeek.tasksCompleted}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {taskImprovement >= 0 ? (
                    <TrendingUp className="text-green-600" size={16} />
                  ) : (
                    <TrendingDown className="text-red-600" size={16} />
                  )}
                  <span className={`text-sm font-medium ${taskImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {taskImprovement > 0 && '+'}{taskImprovement} from last week
                  </span>
                </div>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <CheckCircle className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Points Earned</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {familyTotals.thisWeek.pointsEarned}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {pointsImprovement >= 0 ? (
                    <TrendingUp className="text-green-600" size={16} />
                  ) : (
                    <TrendingDown className="text-red-600" size={16} />
                  )}
                  <span className={`text-sm font-medium ${pointsImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pointsImprovement > 0 && '+'}{pointsImprovement} from last week
                  </span>
                </div>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Star className="text-yellow-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rewards Redeemed</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {familyTotals.thisWeek.rewardsRedeemed}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This week
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Award className="text-green-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Activity Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Daily Activity
          </h2>
          <div className="space-y-3">
            {dailyBreakdown.map((day, index) => {
              const maxTasks = Math.max(...dailyBreakdown.map(d => d.tasks))
              const barWidth = maxTasks > 0 ? (day.tasks / maxTasks) * 100 : 0
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 font-medium">{day.date}</span>
                    <span className="text-gray-800 font-semibold">{day.tasks} tasks • {day.points} pts</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Individual Child Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={20} />
            Individual Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {childrenStats.map(child => (
              <div key={child.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 text-lg mb-3">{child.name}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tasks This Week:</span>
                    <span className="font-semibold text-gray-800">{child.thisWeek.tasksCompleted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Points Earned:</span>
                    <span className="font-semibold text-gray-800">{child.thisWeek.pointsEarned}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Current Balance:</span>
                    <span className="font-semibold text-purple-600">{child.currentPoints} pts</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500 mb-1">vs Last Week:</p>
                  <div className="flex items-center gap-2">
                    {child.improvement.tasks >= 0 ? (
                      <TrendingUp className="text-green-600" size={16} />
                    ) : (
                      <TrendingDown className="text-red-600" size={16} />
                    )}
                    <span className={`text-sm font-medium ${child.improvement.tasks >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {child.improvement.tasks > 0 && '+'}{child.improvement.tasks} tasks
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target size={20} />
            Task Performance
          </h2>
          <div className="space-y-2">
            {taskStats.slice(0, 10).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{task.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {task.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      Assigned to: {task.assignedTo}
                    </span>
                    {task.isRecurring && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        Recurring
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-purple-600">{task.completionsThisWeek}</p>
                  <p className="text-xs text-gray-500">completions</p>
                </div>
              </div>
            ))}
          </div>
          {taskStats.length === 0 && (
            <p className="text-gray-500 text-center py-8">No tasks completed this week yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}