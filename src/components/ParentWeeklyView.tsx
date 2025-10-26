'use client'

import React, { useState, useEffect } from 'react'
import WeekSelector from './WeekSelector'
import { User, TrendingUp, CheckCircle, Target } from 'lucide-react'

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

interface WeeklyData {
  weekStart: Date
  weekEnd: Date
  children: ChildStats[]
  dailyData: DailyData[]
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

  return (
    <div className="max-w-6xl mx-auto">
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {weeklyData.children.map(child => (
              <div key={child.childId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <User size={24} className="text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">{child.childName}</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={18} className="text-green-600" />
                      <span className="text-sm text-gray-600">Tasks</span>
                    </div>
                    <span className="font-semibold text-gray-800">{child.tasksCompleted}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Target size={18} className="text-blue-600" />
                      <span className="text-sm text-gray-600">Habits</span>
                    </div>
                    <span className="font-semibold text-gray-800">{child.habitsCompleted}</span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-yellow-600" />
                        <span className="text-sm font-medium text-gray-700">Total Points</span>
                      </div>
                      <span className="text-xl font-bold text-purple-600">{child.totalPoints}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Daily Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Daily Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Tasks</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Habits</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.dailyData.map((day) => (
                    <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800">{formatDate(day.date)}</td>
                      <td className="py-3 px-4 text-center text-sm text-gray-800">{day.tasks}</td>
                      <td className="py-3 px-4 text-center text-sm text-gray-800">{day.habits}</td>
                      <td className="py-3 px-4 text-center text-sm font-semibold text-purple-600">
                        {day.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td className="py-3 px-4 text-sm text-gray-800">Week Total</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-800">
                      {weeklyData.dailyData.reduce((sum, day) => sum + day.tasks, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-800">
                      {weeklyData.dailyData.reduce((sum, day) => sum + day.habits, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-bold text-purple-600">
                      {weeklyData.dailyData.reduce((sum, day) => sum + day.points, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Empty State */}
          {weeklyData.children.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No children found in your family.</p>
            </div>
          )}

          {weeklyData.children.length > 0 && weeklyData.dailyData.every(d => d.tasks === 0 && d.habits === 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center mt-6">
              <p className="text-gray-600">No activity recorded for this week.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}