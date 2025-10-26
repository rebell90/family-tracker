'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface WeekSelectorProps {
  selectedWeek: Date
  onWeekChange: (newWeek: Date) => void
}

export default function WeekSelector({ selectedWeek, onWeekChange }: WeekSelectorProps) {
  // Get start of week (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  // Get end of week (Saturday)
  const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date)
    return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
  }

  const weekStart = getWeekStart(selectedWeek)
  const weekEnd = getWeekEnd(selectedWeek)

  const goToPreviousWeek = () => {
    const newWeek = new Date(selectedWeek)
    newWeek.setDate(newWeek.getDate() - 7)
    onWeekChange(newWeek)
  }

  const goToNextWeek = () => {
    const newWeek = new Date(selectedWeek)
    newWeek.setDate(newWeek.getDate() + 7)
    onWeekChange(newWeek)
  }

  const goToCurrentWeek = () => {
    onWeekChange(new Date())
  }

  const formatDateRange = () => {
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const endDay = weekEnd.getDate()
    const year = weekStart.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
    }
  }

  const isCurrentWeek = () => {
    const today = new Date()
    const currentWeekStart = getWeekStart(today)
    return weekStart.getTime() === currentWeekStart.getTime()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Previous Week Button */}
        <button
          onClick={goToPreviousWeek}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>

        {/* Week Display */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <Calendar size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              {formatDateRange()}
            </h2>
          </div>
          {isCurrentWeek() && (
            <span className="text-sm text-green-600 font-medium">
              Current Week
            </span>
          )}
        </div>

        {/* Next Week Button */}
        <button
          onClick={goToNextWeek}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next week"
          disabled={isCurrentWeek()}
          style={{ opacity: isCurrentWeek() ? 0.5 : 1 }}
        >
          <ChevronRight size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Quick Jump to Current Week */}
      {!isCurrentWeek() && (
        <div className="mt-3 text-center">
          <button
            onClick={goToCurrentWeek}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Jump to Current Week
          </button>
        </div>
      )}
    </div>
  )
}