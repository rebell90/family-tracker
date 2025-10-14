import { RotateCcw, ShoppingBag } from 'lucide-react'

interface RewardTypeBadgeProps {
  isReusable: boolean
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export default function RewardTypeBadge({ 
  isReusable, 
  size = 'md',
  showIcon = true 
}: RewardTypeBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  }

  if (isReusable) {
    return (
      <span 
        className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 font-medium ${sizeClasses[size]}`}
        title="This reward can be redeemed multiple times"
      >
        {showIcon && <RotateCcw size={iconSizes[size]} />}
        Reusable
      </span>
    )
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 font-medium ${sizeClasses[size]}`}
      title="This reward can only be claimed once"
    >
      {showIcon && <ShoppingBag size={iconSizes[size]} />}
      One-Time
    </span>
  )
}

// Usage in your Rewards list component:
/*
<div className="reward-card">
  <h3>{reward.title}</h3>
  <p>{reward.pointsRequired} points</p>
  
  <div className="flex gap-2 items-center mt-2">
    <RewardTypeBadge isReusable={reward.isReusable} />
    
    {!reward.isReusable && hasBeenRedeemed && (
      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
        ✓ Already claimed
      </span>
    )}
  </div>
</div>
*/

// ALTERNATIVE: Inline text-only version for compact displays
export function RewardTypeText({ isReusable }: { isReusable: boolean }) {
  if (isReusable) {
    return (
      <span className="text-xs text-blue-600">
        🔄 Can redeem again
      </span>
    )
  }
  
  return (
    <span className="text-xs text-purple-600">
      🎁 One-time only
    </span>
  )
}