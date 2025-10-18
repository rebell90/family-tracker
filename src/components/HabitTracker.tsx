'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Target, Plus } from 'lucide-react'

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
  logs: HabitLog[]
}

interface HabitLog {
  id: string
  amount: number
  logDate: string
  notes?: string
}

export default function HabitTracker() {
  const { data: session } = useSession()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logging, setLogging] = useState<string | null>(null)
  const [logAmount, setLogAmount] = useState<Record<string, string>>({})
  const [logNotes, setLogNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchHabits()
  }, [])

  const fetchHabits = async () => {
    try {
      const response = await fetch('/api/habits')
      if (response.ok) {
        const data = await response.json()
        setHabits(data.habits || [])
      }
    } catch (error) {
      console.error('Error fetching habits:', error)
    }
  }

  const handleLogProgress = async (habitId: string) => {
    const amount = logAmount[habitId]
    if (!amount || parseInt(amount) <= 0) {
      setMessage('Please enter a valid amount')
      return
    }

    try {
      const response = await fetch('/api/habits/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          habitId,
          amount: parseInt(amount),
          notes: logNotes[habitId] || ''
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        setLogAmount(prev => ({ ...prev, [habitId]: '' }))
        setLogNotes(prev => ({ ...prev, [habitId]: '' }))
        setLogging(null)
        fetchHabits()
        
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(data.error || 'Failed to log progress')
      }
    } catch (error) {
      console.error('Error logging habit:', error)
      setMessage('Failed to log progress')
    }
  }

  const getTodayProgress = (habit: Habit) => {
    if (habit.logs && habit.logs.length > 0) {
      return habit.logs[0].amount
    }
    return 0
  }

  const getProgressPercentage = (habit: Habit) => {
    const progress = getTodayProgress(habit)
    return Math.min((progress / habit.goalAmount) * 100, 100)
  }

  const getMeasurementLabel = (habit: Habit) => {
    if (habit.measurementUnit) return habit.measurementUnit
    
    switch (habit.measurementType) {
      case 'MINUTES': return 'min'
      case 'PAGES': return 'pages'
      case 'REPS': return 'reps'
      case 'DISTANCE': return 'miles'
      case 'COUNT': return 'times'
      default: return ''
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">My Habits</h2>
        <p className="text-sm sm:text-base text-gray-600">Track your daily progress and build great habits!</p>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {habits.map((habit) => {
          const todayProgress = getTodayProgress(habit)
          const progressPercent = getProgressPercentage(habit)
          const goalMet = todayProgress >= habit.goalAmount
          const label = getMeasurementLabel(habit)

          return (
            <div 
              key={habit.id} 
              className={`bg-white rounded-xl shadow-sm border-2 p-4 sm:p-6 transition-all ${
                goalMet ? 'border-green-300 bg-green-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className={`text-2xl sm:text-3xl shrink-0 ${habit.color || ''}`}>
                    {habit.icon || '🎯'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base break-words">
                      {habit.title}
                    </h3>
                    {habit.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                        {habit.description}
                      </p>
                    )}
                  </div>
                </div>
                {goalMet && (
                  <div className="text-2xl shrink-0">✅</div>
                )}
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">
                    {todayProgress} / {habit.goalAmount} {label}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-600">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                  <div 
                    className={`h-2.5 sm:h-3 rounded-full transition-all ${
                      goalMet ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {habit.pointsPerGoal && (
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                    ⭐ {habit.pointsPerGoal} points when complete
                  </span>
                </div>
              )}

              {logging === habit.id ? (
                <div className="space-y-2 sm:space-y-3 pt-3 border-t border-gray-200">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Amount ({label})
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={logAmount[habit.id] || ''}
                      onChange={(e) => setLogAmount(prev => ({ ...prev, [habit.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder={`e.g., 10 ${label}`}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={logNotes[habit.id] || ''}
                      onChange={(e) => setLogNotes(prev => ({ ...prev, [habit.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="What did you do?"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLogProgress(habit.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setLogging(null)
                        setLogAmount(prev => ({ ...prev, [habit.id]: '' }))
                        setLogNotes(prev => ({ ...prev, [habit.id]: '' }))
                      }}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLogging(habit.id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Plus size={16} />
                  Log Progress
                </button>
              )}
            </div>
          )
        })}
      </div>

      {habits.length === 0 && (
        <div className="text-center py-8 sm:py-12 text-gray-500">
          <Target size={40} className="sm:w-12 sm:h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm sm:text-base">No habits yet.</p>
          <p className="text-xs sm:text-sm">Ask a parent to create some habits for you!</p>
        </div>
      )}
    </div>
  )
}