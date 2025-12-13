// REDESIGNED src/components/RewardManager.tsx
// WITH SEPARATE PENDING APPROVALS SECTION AT THE TOP
//
// KEY CHANGES:
// 1. Pending approvals shown in dedicated section at top (parents only)
// 2. Cleaner reward cards without pending requests cluttering them
// 3. Better visual hierarchy and organization
// 4. Fixed parameter name: approved (not approve)

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Gift, Plus, Star, Check, X, Edit2, Trash2, AlertCircle } from 'lucide-react'

// Define interfaces
interface Reward {
  id: string;
  title: string;
  description?: string;
  pointsRequired: number;
  createdBy: {
    name: string;
  };
  redemptions: Redemption[];
}

interface Redemption {
  id: string;
  rewardId: string;
  userId: string;
  redeemedAt: string;
  user: {
    name: string;
  };
  reward: {
    title: string;
    pointsRequired: number;
  };
}

export default function RewardManager() {
  const { data: session } = useSession()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    pointsRequired: 10
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const user = session?.user as { name?: string; role?: string } | undefined
  const isParent = user?.role === 'PARENT'

  // Get all pending redemptions across all rewards
  const allPendingRedemptions: Redemption[] = rewards.flatMap(reward => 
    reward.redemptions.map(redemption => ({
      ...redemption,
      reward: {
        title: reward.title,
        pointsRequired: reward.pointsRequired
      }
    }))
  )

  useEffect(() => {
    fetchRewards()
  }, [])

  const fetchRewards = async () => {
    try {
      const response = await fetch('/api/rewards')
      if (response.ok) {
        const data = await response.json()
        setRewards(data.rewards || [])
      }
    } catch (error) {
      console.error('Error fetching rewards:', error)
    }
  }

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReward),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Reward created successfully!')
        setNewReward({ title: '', description: '', pointsRequired: 10 })
        setShowCreateForm(false)
        fetchRewards()
      } else {
        setMessage(data.error || 'Failed to create reward')
      }
    } catch (error) {
      console.error('Error creating reward:', error)
      setMessage('Failed to create reward')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return

    try {
      const response = await fetch(`/api/rewards/${rewardId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('Reward deleted successfully!')
        fetchRewards()
      } else {
        setMessage('Failed to delete reward')
      }
    } catch (error) {
      console.error('Error deleting reward:', error)
      setMessage('Failed to delete reward')
    }
  }

  const startEditReward = (reward: Reward) => {
    setEditingReward(reward)
    setNewReward({
      title: reward.title,
      description: reward.description || '',
      pointsRequired: reward.pointsRequired
    })
    setShowCreateForm(true)
  }

  const handleUpdateReward = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReward) return

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/rewards/${editingReward.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReward),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Reward updated successfully!')
        setNewReward({ title: '', description: '', pointsRequired: 10 })
        setShowCreateForm(false)
        setEditingReward(null)
        fetchRewards()
      } else {
        setMessage(data.error || 'Failed to update reward')
      }
    } catch (error) {
      console.error('Error updating reward:', error)
      setMessage('Failed to update reward')
    } finally {
      setLoading(false)
    }
  }

  const cancelEdit = () => {
    setEditingReward(null)
    setNewReward({ title: '', description: '', pointsRequired: 10 })
    setShowCreateForm(false)
  }

  const handleRedeemReward = async (rewardId: string) => {
    try {
      const response = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardId }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        fetchRewards()
        
        // Trigger a page refresh to update points display
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setMessage(data.error)
      }
    } catch (error) {
      console.error('Error redeeming reward:', error)
      setMessage('Failed to redeem reward')
    }
  }

  const handleApproval = async (redemptionId: string, approve: boolean) => {
    try {
      console.log('🔄 Processing approval:', { redemptionId, approve })
      
      const response = await fetch('/api/rewards/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ redemptionId, approved: approve }),  // ✅ FIXED: approved (not approve)
      })

      const data = await response.json()
      console.log('📥 Response:', data)
      
      if (response.ok) {
        setMessage(data.message)
        fetchRewards()  // Refresh to update pending list
      } else {
        setMessage(data.error)
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      setMessage('Failed to process approval')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Reward Store</h2>
        <p className="text-gray-600">
          {isParent ? 'Manage family rewards and approve redemptions' : 'Redeem your points for awesome rewards!'}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {/* ===== PENDING APPROVALS SECTION (PARENTS ONLY) ===== */}
      {isParent && allPendingRedemptions.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-400 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-500 p-2 rounded-lg">
              <AlertCircle className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-orange-900">
                Pending Approvals
              </h3>
              <p className="text-sm text-orange-700">
                {allPendingRedemptions.length} reward request{allPendingRedemptions.length !== 1 ? 's' : ''} waiting for your decision
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {allPendingRedemptions.map((redemption) => (
              <div 
                key={redemption.id} 
                className="bg-white rounded-lg p-4 shadow-sm border border-orange-200 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{redemption.user.name}</span>
                    <span className="text-gray-500">wants</span>
                    <span className="font-semibold text-purple-700">{redemption.reward.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Star size={14} className="text-yellow-500" />
                    <span>{redemption.reward.pointsRequired} points</span>
                    <span className="text-gray-400">•</span>
                    <span>{new Date(redemption.redeemedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleApproval(redemption.id, true)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 shadow-md"
                  >
                    <Check size={16} />
                    Approve
                  </button>
                  <button 
                    onClick={() => handleApproval(redemption.id, false)}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 shadow-md"
                  >
                    <X size={16} />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Reward Form (Parents only) */}
      {isParent && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {editingReward ? 'Edit Reward' : 'Create New Reward'}
            </h3>
            <button
              onClick={() => editingReward ? cancelEdit() : setShowCreateForm(!showCreateForm)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showCreateForm 
                  ? 'bg-gray-500 hover:bg-gray-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {showCreateForm ? (
                <>
                  <X size={16} />
                  Cancel
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Reward
                </>
              )}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={editingReward ? handleUpdateReward : handleCreateReward} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Reward Title
                </label>
                <input
                  type="text"
                  required
                  value={newReward.title}
                  onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                  placeholder="e.g., Choose tonight's movie"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newReward.description}
                  onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                  rows={2}
                  placeholder="Additional details about this reward..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Points Required
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newReward.pointsRequired}
                  onChange={(e) => setNewReward({ ...newReward, pointsRequired: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? (editingReward ? 'Updating...' : 'Creating...') : (editingReward ? 'Update Reward' : 'Create Reward')}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Rewards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward) => (
          <div key={reward.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-2 rounded-lg">
                <Gift className="text-purple-600" size={24} />
              </div>
              <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-sm font-medium">
                <Star size={14} />
                {reward.pointsRequired}
              </div>
            </div>

            <h3 className="font-semibold text-gray-800 mb-2">{reward.title}</h3>
            
            {reward.description && (
              <p className="text-sm text-gray-600 mb-4">{reward.description}</p>
            )}

            <div className="text-xs text-gray-500 mb-4">
              Created by {reward.createdBy.name}
            </div>

            {/* Edit/Delete buttons for parents */}
            {isParent && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => startEditReward(reward)}
                  className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex-1"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReward(reward.id)}
                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex-1"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}

            {/* Redeem Button (Children only) */}
            {!isParent && (
              <button 
                onClick={() => handleRedeemReward(reward.id)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all hover:scale-105 shadow-md"
              >
                Redeem for {reward.pointsRequired} points
              </button>
            )}
          </div>
        ))}
      </div>

      {rewards.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Gift size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No rewards available yet.</p>
          {isParent && <p className="text-sm">Create your first reward to get started!</p>}
        </div>
      )}
    </div>
  )
}