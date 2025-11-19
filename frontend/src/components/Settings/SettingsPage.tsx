import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">User Profile</h2>
        <div className="space-y-2">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Name:</strong> {user?.name}</p>
        </div>
      </div>
      
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">API Configuration</h2>
        <p className="text-muted-foreground">Configure your API keys and settings</p>
      </div>
      
      <div className="rounded-lg border p-6">
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default SettingsPage