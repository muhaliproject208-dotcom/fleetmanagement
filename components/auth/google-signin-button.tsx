'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/lib/auth-helpers'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'

interface GoogleSignInButtonProps {
  className?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function GoogleSignInButton({ 
  className, 
  onSuccess, 
  onError 
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    
    try {
      await signInWithGoogle()
      onSuccess?.()
    } catch (error) {
      console.error('Google sign in failed:', error)
      onError?.(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-4 w-4" />
      )}
      Continue with Google
    </Button>
  )
}
