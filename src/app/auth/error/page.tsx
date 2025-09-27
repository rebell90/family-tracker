'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Authentication Error</h1>
        <p className="text-gray-600 mb-6">
          {error === 'CredentialsSignin' 
            ? 'Invalid email or password. Please try again.'
            : 'There was a problem signing you in. Please try again.'}
        </p>
        <Link 
          href="/auth/signin"
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}