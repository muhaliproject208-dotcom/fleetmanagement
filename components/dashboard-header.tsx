"use client"

interface DashboardHeaderProps {
  user: any
  onLogout: () => void
}

export default function DashboardHeader({ user, onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-700">IFSM</h1>
          <p className="text-xs text-gray-600">Fleet Safety Management System</p>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <p className="text-xs text-gray-600 capitalize">{user.user_metadata?.role}</p>
            </div>
          )}

          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
