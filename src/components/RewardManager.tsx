'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Gift, Plus, Star, Check, X, Edit2, Trash2, RotateCcw, ShoppingBag } from 'lucide-react'

// Define interfaces at the top
interface Reward {
  id: string;
  title: string;
  description?: string;
  pointsRequired: number;
  isReusable: boolean;  //  NEW
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
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    pointsRequired: 10,
    isReusable: true  //  NEW: Defaults to reusable
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
        body: JSON.stringify(newReward),  // ⭐ Already includes isReusable
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Reward created successfully!')
        setNewReward({ title: '', description: '', pointsRequired: 10, isReusable: true })  // ⭐ Reset with default
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
      pointsRequired: reward.pointsRequired,
      isReusable: reward.isReusable  // ⭐ Include in edit
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
        body: JSON.stringify(newReward),  // ⭐ Already includes isReusable
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Reward updated successfully!')
        setNewReward({ title: '', description: '', pointsRequired: 10, isReusable: true })  // ⭐ Reset
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
    setNewReward({ title: '', description: '', pointsRequired: 10, isReusable: true })  // ⭐ Reset
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

              {/*  NEW: Reward Type Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Reward Type
                </label>
                
                <div className="grid md:grid-cols-2 gap-3">
                  {/* Reusable Reward Option */}
                  <button
                    type="button"
                    onClick={() => setNewReward({ ...newReward, isReusable: true })}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      newReward.isReusable
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        newReward.isReusable ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <RotateCcw size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          Reusable Reward
                        </div>
                        <p className="text-sm text-gray-600">
                          Can be redeemed multiple times
                        </p>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <div>✓ 30 min iPad time</div>
                          <div>✓ Choose dinner</div>
                          <div>✓ Stay up late</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* One-Time Reward Option */}
                  <button
                    type="button"
                    onClick={() => setNewReward({ ...newReward, isReusable: false })}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      !newReward.isReusable
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        !newReward.isReusable ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <ShoppingBag size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          One-Time Reward
                        </div>
                        <p className="text-sm text-gray-600">
                          Can only be redeemed once
                        </p>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <div>✓ New toy purchase</div>
                          <div>✓ Trip to theme park</div>
                          <div>✓ Special birthday gift</div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Explanation based on selection */}
                <div className={`p-3 rounded-lg text-sm ${
                  newReward.isReusable 
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-purple-50 text-purple-800 border border-purple-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <Gift size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      {newReward.isReusable ? (
                        <>
                          <strong>Routine Reward:</strong> This reward will stay available after being 
                          redeemed. Great for privileges and experiences that can be earned repeatedly.
                        </>
                      ) : (
                        <>
                          <strong>Wishlist Item:</strong> This reward will disappear after 
                          redemption and will not appear in the rewards list anymore. Perfect for physical 
                          items or one-time experiences.
                        </>
                      )}
                    </div>
                  </div>
                </div>
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
              <p className="text-sm text-gray-600 mb-3">{reward.description}</p>
            )}

            {/*  NEW: Reward Type Badge */}
            <div className="mb-3">
              {reward.isReusable ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                  <RotateCcw size={12} />
                  Reusable
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                  <ShoppingBag size={12} />
                  One-Time
                </span>
              )}
            </div>

            <div className="text-xs text-gray-700 mb-4 font-medium">
              Created by {reward.createdBy.name}
            </div>

            {/* Edit/Delete buttons for parents */}
            {isParent && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => startEditReward(reward)}
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
                  <div key={redemption.id} className="flex items-center justify-between text-sm">
                    <span className="text-orange-700">{redemption.user.name}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleApproval(redemption.id, true)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => handleApproval(redemption.id, false)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={16} />
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