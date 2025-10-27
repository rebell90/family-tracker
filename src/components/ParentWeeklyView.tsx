'use client'

import React, { useState, useEffect } from 'react'
import WeekSelector from './WeekSelector'
import { User, TrendingUp, CheckCircle, Target, Award, Calendar, BarChart3, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface ChildStats {
  childId: string
  childName: string
  tasksCompleted: number
  taskPoints: number
  habitsCompleted: number
  habitPoints: number
  totalPoints: number
}

interface DailyData {
  date: string
  tasks: number
  points: number
  habits: number
}

interface TaskCompletion {
  id: string
  completedAt: string
  task: {
    title: string
    points: number
    category: string
  }
  user: {
    name: string
  }
}

interface WeeklyData {
  weekStart: Date
  weekEnd: Date
  children: ChildStats[]
  dailyData: DailyData[]
  taskCompletions: TaskCompletion[]
}

const CATEGORY_COLORS: Record<string, string> = {
  CHORES: '#3b82f6',
  HOMEWORK: '#10b981',
  PERSONAL_CARE: '#8b5cf6',
  GOALS: '#f59e0b',
  OTHER: '#6b7280'
}

export default function ParentWeeklyView() {
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedChild, setSelectedChild] = useState<string | 'all'>('all')

  // Get week boundaries
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }

  // Fetch weekly data
  const fetchWeeklyData = async () => {
    setLoading(true)
    try {
      const weekStart = getWeekStart(selectedWeek)
      const weekEnd = getWeekEnd(selectedWeek)

      const params = new URLSearchParams({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString()
      })

      if (selectedChild !== 'all') {
        params.append('childId', selectedChild)
      }

      const response = await fetch(`/api/weekly-data?${params}`)
      if (response.ok) {
        const data = await response.json()
        setWeeklyData(data)
      } else {
        console.error('Failed to fetch weekly data')
      }
    } catch (error) {
      console.error('Error fetching weekly data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeeklyData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedChild])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
  }

  // Calculate category breakdown
  const getCategoryBreakdown = () => {
    if (!weeklyData) return []

    const categoryMap: Record<string, number> = {}
    
    weeklyData.taskCompletions.forEach(tc => {
      const category = tc.task.category || 'OTHER'
      categoryMap[category] = (categoryMap[category] || 0) + 1
    })

    return Object.entries(categoryMap).map(([category, count]) => ({
      name: category.replace('_', ' '),
      value: count,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER
    }))
  }

  // Calculate completion rate
  const getCompletionRate = () => {
    if (!weeklyData || weeklyData.dailyData.length === 0) return 0
    
    const totalDays = 7
    const activeDays = weeklyData.dailyData.filter(d => d.tasks > 0 || d.habits > 0).length
    return Math.round((activeDays / totalDays) * 100)
  }

  // Get best performing day
  const getBestDay = () => {
    if (!weeklyData || weeklyData.dailyData.length === 0) return 'N/A'
    
    const bestDay = weeklyData.dailyData.reduce((best, current) => 
      current.points > best.points ? current : best
    )
    
    return formatDate(bestDay.date)
  }

  // Calculate streak
  const getCurrentStreak = () => {
    if (!weeklyData) return 0
    
    let streak = 0
    const sortedDays = [...weeklyData.dailyData].reverse()
    
    for (const day of sortedDays) {
      if (day.tasks > 0 || day.habits > 0) {
        streak++
      } else {
        break
      }
    }
    
    return streak
  }

  // Export to CSV
  const exportToCSV = () => {
    if (!weeklyData) return

    const headers = ['Date', 'Child', 'Task', 'Category', 'Points']
    const rows = weeklyData.taskCompletions.map(tc => [
      new Date(tc.completedAt).toLocaleDateString(),
      tc.user.name,
      tc.task.title,
      tc.task.category,
      tc.task.points
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `family-report-${formatShortDate(weeklyData.weekStart.toString())}.csv`
    a.click()
  }

  const categoryData = getCategoryBreakdown()
  const completionRate = getCompletionRate()
  const bestDay = getBestDay()
  const currentStreak = getCurrentStreak()

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with Export */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Weekly Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive family performance insights</p>
        </div>
        {weeklyData && weeklyData.taskCompletions.length > 0 && (
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        )}
      </div>

      {/* Week Selector */}
      <WeekSelector 
        selectedWeek={selectedWeek} 
        onWeekChange={setSelectedWeek}
      />

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="text-gray-600 mt-2">Loading weekly data...</p>
        </div>
      )}

      {!loading && weeklyData && (
        <>
          {/* Child Filter */}
          {weeklyData.children.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Child
              </label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
              >
                <option value="all">All Children</option>
                {weeklyData.children.map(child => (
                  <option key={child.childId} value={child.childId}>
                    {child.childName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Award size={24} />
                <h3 className="text-sm font-medium opacity-90">Total Points</h3>
              </div>
              <p className="text-3xl font-bold">
                {weeklyData.children.reduce((sum, child) => sum + child.totalPoints, 0)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle size={24} />
                <h3 className="text-sm font-medium opacity-90">Tasks Completed</h3>
              </div>
              <p className="text-3xl font-bold">
                {weeklyData.children.reduce((sum, child) => sum + child.tasksCompleted, 0)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp size={24} />
                <h3 className="text-sm font-medium opacity-90">Completion Rate</h3>
              </div>
              <p className="text-3xl font-bold">{completionRate}%</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={24} />
                <h3 className="text-sm font-medium opacity-90">Current Streak</h3>
              </div>
              <p className="text-3xl font-bold">{currentStreak} days</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Daily Activity Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-purple-600" />
                Daily Activity
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatShortDate}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label)}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="tasks" fill="#8b5cf6" name="Tasks" />
                  <Bar dataKey="habits" fill="#10b981" name="Habits" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Points Trend Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-purple-600" />
                Points Trend
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatShortDate}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label)}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="points" 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    name="Points Earned"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown and Child Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Category Breakdown Pie Chart */}
            {categoryData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Category Breakdown</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                                      <Pie
                                          data={categoryData}
                                          cx="50%"
                                          cy="50%"
                                          outerRadius={80}
                                          fill="#8884d8"
                                          dataKey="value"
                                          label
                                      >
                                          {categoryData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                      </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Child Performance Cards */}
            {weeklyData.children.map(child => (
              <div key={child.childId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <User size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{child.childName}</h3>
                    <p className="text-sm text-gray-600">Performance Summary</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Tasks Completed</span>
                    <span className="font-semibold text-gray-800">{child.tasksCompleted}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Habits Logged</span>
                    <span className="font-semibold text-gray-800">{child.habitsCompleted}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Task Points</span>
                    <span className="font-semibold text-purple-600">{child.taskPoints}</span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Total Points</span>
                    <span className="text-xl font-bold text-purple-600">{child.totalPoints}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Insights Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-sm border border-blue-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Weekly Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Best Day</p>
                <p className="text-lg font-bold text-gray-800">{bestDay}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Average Points/Day</p>
                <p className="text-lg font-bold text-gray-800">
                  {weeklyData.dailyData.length > 0 
                    ? Math.round(weeklyData.dailyData.reduce((sum, d) => sum + d.points, 0) / 7)
                    : 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Most Active Category</p>
                <p className="text-lg font-bold text-gray-800">
                  {categoryData.length > 0 
                    ? categoryData.reduce((max, cat) => cat.value > max.value ? cat : max).name
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Activity Log */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Activity Log</h2>
            
            {weeklyData.taskCompletions.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {weeklyData.taskCompletions.slice(0, 50).map((tc) => (
                  <div key={tc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{tc.task.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          tc.task.category === 'CHORES' ? 'bg-blue-100 text-blue-700' :
                          tc.task.category === 'HOMEWORK' ? 'bg-green-100 text-green-700' :
                          tc.task.category === 'PERSONAL_CARE' ? 'bg-purple-100 text-purple-700' :
                          tc.task.category === 'GOALS' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {tc.task.category?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {tc.user.name} • {new Date(tc.completedAt).toLocaleString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className="font-bold text-purple-600">+{tc.task.points}</span>
                  </div>
                ))}
                {weeklyData.taskCompletions.length > 50 && (
                  <p className="text-center text-sm text-gray-500 pt-2">
                    Showing 50 of {weeklyData.taskCompletions.length} completions
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-600 py-8">No activity recorded for this week.</p>
            )}
          </div>

          {/* Empty State */}
          {weeklyData.children.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No children found in your family.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}