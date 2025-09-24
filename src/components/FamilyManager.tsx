'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Users, UserPlus, Mail } from 'lucide-react'

interface FamilyMember {
  id: string
  name: string
  email: string
  role: string
}

export default function FamilyManager() {
  const { data: session } = useSession();
  console.log(session); 
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchFamilyMembers()
  }, [])

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch('/api/family')
      if (response.ok) {
        const data = await response.json()
        setFamilyMembers(data.members)
      }
    } catch (error) {
      console.error('Error fetching family members:', error)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/family/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          action: 'invite'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        setInviteEmail('')
        fetchFamilyMembers()
      } else {
        setError(data.error)
      }
    } .catch((error) => {
      console.error('Error:', error);
      setError('Failed to send invite')
    })
  }

const handleJoin = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  setMessage('')

  try {
    const response = await fetch('/api/family/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: joinEmail,
        action: 'join'
      }),
    })

    const data = await response.json()

    if (response.ok) {
      // Check if migration is needed
      if (data.needsMigration) {
        const migrate = confirm(`You have ${data.taskCount} existing tasks. Move them to your new family?`)
        
        if (migrate) {
          try {
            console.log('Attempting migration with:', {
              oldFamilyId: data.oldFamilyId,
              newFamilyId: data.familyId
            })
            
            const migrateResponse = await fetch('/api/family/migrate-tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                oldFamilyId: data.oldFamilyId,  // ← CHANGED: Use data.oldFamilyId
                newFamilyId: data.familyId
              })
            })
            
            console.log('Migration response status:', migrateResponse.status)
            const result = await migrateResponse.json()
            console.log('Migration result:', result)
            
            if (migrateResponse.ok) {
              setMessage(`${data.message} ${result.message}`)
            } else {
              setMessage(data.message + ' (Tasks were not migrated: ' + result.error + ')')
            }
          } catch (error) {
            console.error('Migration failed:', error)
            setMessage(data.message + ' (Task migration failed)')
          }
        } else {
          setMessage(data.message + ' (Tasks were not moved)')
        }
      } else {
        setMessage(data.message)
      }
      
      setJoinEmail('')
      fetchFamilyMembers()
      
      // Refresh the page to show updated tasks
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } else {
      setError(data.error)
    }
  } .catch((error) => {
    console.error('Error:', error);
    setError('Failed to join family')
  })
}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Family Management</h2>
        <p className="text-gray-600">Manage your family members and invitations</p>
      </div>

      {/* Current Family Members */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} />
          Current Family Members ({familyMembers.length})
        </h3>
        
        {familyMembers.length === 0 ? (
          <p className="text-gray-500">No family members yet. Invite someone or join an existing family below.</p>
        ) : (
          <div className="space-y-3">
            {familyMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-800">{member.name}</h4>
                  <p className="text-sm text-gray-600">{member.email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  member.role === 'PARENT' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {member.role === 'PARENT' ? '👨‍👩‍👧‍👦 Parent' : '🧒 Child'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Invite to Family */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus size={20} />
          Invite Someone to Your Family
        </h3>
        
        <form onSubmit={handleInvite} className="flex gap-4">
          <div className="flex-1">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500"
              placeholder="Enter email address to invite"
            />
          </div>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Mail size={16} />
            Invite
          </button>
        </form>
      </div>

      {/* Join Family */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} />
          Join Someone&apos;s Family
        </h3>
        
        <form onSubmit={handleJoin} className="flex gap-4">
          <div className="flex-1">
            <input
              type="email"
              required
              value={joinEmail}
              onChange={(e) => setJoinEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-500"
              placeholder="Enter email of family member to join their family"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <UserPlus size={16} />
            Join Family
          </button>
        </form>
      </div>
    </div>
  )
}
