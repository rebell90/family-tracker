'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Gift, Plus, Star, Check, X, Edit2, Trash2 } from 'lucide-react'

// Define interfaces at the top
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
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  user: {
    name: string;
  };
  reward: Reward;
}

export default function RewardManager() {
  const { data: session } = useSession()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [myRedemptions, setMyRedemptions] = useState<Redemption[]>([])
  const [showModal, setShowModal] = useState(false)
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

  useEffect(() => {
    fetchRewards()
    if (!isParent) {
      fetchMyRedemptions()
    }
  }, [isParent])

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

  const fetchMyRedemptions = async () => {
    try {
      const response = await fetch('/api/rewards/my-redemptions')
      if (response.ok) {
        const data = await response.json()
        setMyRedemptions(data.redemptions || [])
      }
    } catch (error) {
      console.error('Error fetching redemptions:', error)
    }
  }

  const openModal = (reward?: Reward) => {
    if (reward) {
      setEditingReward(reward)
      setNewReward({
        title: reward.title,
        description: reward.description || '',
        pointsRequired: reward.pointsRequired
      })
    } else {
      setEditingReward(null)
      setNewReward({ title: '', description: '', pointsRequired: 10 })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingReward(null)
    setNewReward({ title: '', description: '', pointsRequired: 10 })
    setMessage('')
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
        fetchRewards()
        setTimeout(closeModal, 1000)
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
        fetchRewards()
        setTimeout(closeModal, 1000)
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
      const response = await fetch('/api/rewards/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ redemptionId, approve }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setMessage(data.message)
        fetchRewards()
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

      {/* Add Reward Button (Parents only) */}
      {isParent && (
        <button
          onClick={() => openModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Reward
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingReward ? `Edit Reward: ${editingReward.title}` : 'Create New Reward'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingReward ? handleUpdateReward : handleCreateReward} className="p-6 space-y-4">
              {message && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
                  {message}
                </div>
              )}

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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {loading ? (editingReward ? 'Updating...' : 'Creating...') : (editingReward ? 'Update Reward' : 'Create Reward')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rewards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward) => (
          <div key={reward.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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

            <div className="text-xs text-gray-700 mb-4 font-medium">
              Created by {reward.createdBy.name}
            </div>

            {/* Edit/Delete buttons for parents */}
            {isParent && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => openModal(reward)}
                  className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReward(reward.id)}
                  className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}

            {/* Pending Redemptions (Parents only) */}
            {isParent && reward.redemptions.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-800 mb-2">
                  Pending Requests ({reward.redemptions.length})
                </p>
                {reward.redemptions.map((redemption) => (
                  <div key={redemption.id} className="space-y-2">
                    <span className="text-sm text-orange-700 block">{redemption.user.name}</span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        onClick={() => handleApproval(redemption.id, true)}
                        className="flex-1 flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
                      >
                        <Check size={14} />
                        <span>Approve</span>
                      </button>
                      <button 
                        onClick={() => handleApproval(redemption.id, false)}
                        className="flex-1 flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
                      >
                        <X size={14} />
                        <span>Deny</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Redeem Button (Children only) */}
            {!isParent && (
              <button 
                onClick={() => handleRedeemReward(reward.id)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
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