'use client'

import { cn } from '@/lib/utils'
import { Icons } from '@/components/ui/icons'

type AppLoaderProps = {
  label?: string
  className?: string
  spinnerClassName?: string
}

export function AppPageLoader({ label = 'Loading...', className, spinnerClassName }: AppLoaderProps) {
  return (
    <div className={cn('min-h-screen bg-gray-50 flex items-center justify-center', className)}>
      <div className="text-center">
        <Icons.spinner className={cn('h-10 w-10 text-green-600 animate-spin mx-auto', spinnerClassName)} />
        <p className="mt-4 text-gray-600">{label}</p>
      </div>
    </div>
  )
}

export function AppInlineLoader({ label = 'Loading...', className, spinnerClassName }: AppLoaderProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Icons.spinner className={cn('h-4 w-4 text-current animate-spin', spinnerClassName)} />
      <span>{label}</span>
    </div>
  )
}
