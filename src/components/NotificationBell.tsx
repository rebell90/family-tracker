'use client'

// src/components/NotificationBell.tsx
// REAL-TIME NOTIFICATIONS with Server-Sent Events! 🚀

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, X } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  task?: {
    id: string
    title: string
    points: number
  } | null
}

interface Toast {
  id: string
  notification: Notification
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Prevent hydration issues - only render after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        
        // Count unread
        const unread = data.notifications?.filter((n: Notification) => !n.read).length || 0
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!mounted) return

    let reconnectTimeout: NodeJS.Timeout

    const connectSSE = () => {
      try {
        console.log('📡 Connecting to notification stream...')
        const eventSource = new EventSource('/api/notifications/stream')
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log('✅ SSE Connected!')
          setSseConnected(true)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'connected') {
              console.log('📡 SSE stream ready')
              // Fetch initial notifications
              fetchNotifications()
            } else if (data.type === 'notification') {
              console.log('🔔 New notification received:', data.notification)
              
              // Add to notifications list
              setNotifications(prev => [data.notification, ...prev])
              setUnreadCount(prev => prev + 1)
              
              // Show toast
              showToast(data.notification)
              
              // Play sound (optional)
              playNotificationSound()
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('❌ SSE error:', error)
          setSseConnected(false)
          eventSource.close()
          
          // Reconnect after 5 seconds
          console.log('🔄 Reconnecting in 5 seconds...')
          reconnectTimeout = setTimeout(() => {
            connectSSE()
          }, 5000)
        }
      } catch (error) {
        console.error('Failed to connect SSE:', error)
        // Fallback to polling if SSE fails
        console.log('⚠️ Falling back to polling')
        const pollInterval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(pollInterval)
      }
    }

    // Initial connection
    connectSSE()

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [mounted])

  // Show toast notification
  const showToast = (notification: Notification) => {
    const toast: Toast = {
      id: `toast-${Date.now()}`,
      notification,
    }
    
    setToasts(prev => [...prev, toast])
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, 5000)
  }

  // Play notification sound (optional)
  const playNotificationSound = () => {
    try {
      // Simple beep using Web Audio API
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      
      const audioContext = new AudioContextClass()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      // Sound not supported or blocked
    }
  }

  // Close toast
  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return '📋'
      case 'TASK_COMPLETED':
        return '✅'
      case 'REWARD_APPROVED':
        return '🎉'
      case 'REWARD_DENIED':
        return '❌'
      case 'REMINDER':
        return '⏰'
      default:
        return '📢'
    }
  }

  // Format time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Bell size={24} className="text-gray-600" />
      </button>
    )
  }

  return (
    <>
      {/* Toast Notifications - Fixed position at top-right */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-white rounded-lg shadow-2xl border-2 border-purple-200 p-4 w-80 animate-slide-in pointer-events-auto"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {getNotificationIcon(toast.notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {toast.notification.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {toast.notification.message}
                </p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notification Bell */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={24} className="text-gray-600" />
          
          {/* Connection indicator */}
          {sseConnected && (
            <span className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" 
                  title="Real-time connected" />
          )}
          
          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">Notifications</h3>
                {sseConnected && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Live
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto max-h-[500px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {timeAgo(notification.createdAt)}
                          </p>
                        </div>

                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                            aria-label="Mark as read"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS for toast animation */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}