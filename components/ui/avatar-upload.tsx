'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Camera, User } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase-client'

interface AvatarUploadProps {
  currentAvatar?: string
  userId: string
  onAvatarChange: (url: string) => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function AvatarUpload({ 
  currentAvatar, 
  userId, 
  onAvatarChange, 
  size = 'md',
  className = '' 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentAvatar)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = getSupabaseClient()

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId)

      if (updateError) {
        throw updateError
      }

      onAvatarChange(publicUrl)
      setPreview(publicUrl)

    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload avatar. Please try again.')
      setPreview(currentAvatar)
    } finally {
      setUploading(false)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300 flex items-center justify-center group cursor-pointer hover:border-green-500 transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload avatar"
      >
        {preview ? (
          <img 
            src={preview} 
            alt="Avatar" 
            className="w-full h-full object-cover"
          />
        ) : (
          <User className={`${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-16 h-16'} text-gray-400`} />
        )}
        
        {/* Upload overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Select avatar image"
      />
    </div>
  )
}
