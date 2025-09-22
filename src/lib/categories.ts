export const TASK_CATEGORIES = {
  CHORES: {
    label: 'Chores',
    icon: '🏠',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  HOMEWORK: {
    label: 'Homework',
    icon: '📚',
    color: 'bg-green-100 text-green-700 border-green-200',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  PERSONAL_CARE: {
    label: 'Personal Care',
    icon: '🧴',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  GOALS: {
    label: 'Goals',
    icon: '🎯',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  OTHER: {
    label: 'Other',
    icon: '📝',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  }
} as const

export type TaskCategory = keyof typeof TASK_CATEGORIES

export function getCategoryInfo(category: TaskCategory) {
  return TASK_CATEGORIES[category] || TASK_CATEGORIES.OTHER
}
