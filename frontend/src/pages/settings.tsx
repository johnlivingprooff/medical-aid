import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/components/auth/auth-context'

interface UserSettings {
  id: number
  accent_color?: string
  logo_url?: string
  notifications_enabled?: boolean
  email_alerts?: boolean
  language?: string
  timezone?: string
}

interface SystemSetting {
  id: number
  key: string
  value: string
  value_type: string
  description: string
  updated_by_name?: string
  updated_at: string
}

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [systemSaving, setSystemSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemError, setSystemError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    accent_color: '#2E7DFF',
    logo_url: '/logo.svg',
    notifications_enabled: true,
    email_alerts: true,
    language: 'en',
    timezone: 'UTC'
  })
  const [systemFormData, setSystemFormData] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        setSystemError(null)

        // Fetch user settings (placeholder for now)
        const defaultSettings = {
          id: user?.id || 0,
          accent_color: '#2E7DFF',
          logo_url: '/logo.svg',
          notifications_enabled: true,
          email_alerts: true,
          language: 'en',
          timezone: 'UTC'
        }

        setSettings(defaultSettings)
        setFormData(defaultSettings)

        // Fetch system settings if user is admin
        if (user?.role === 'ADMIN') {
          try {
            const systemResponse = await api.get('/api/core/settings/')
            // Handle paginated response from DRF
            const responseData = systemResponse as any
            const systemSettingsData = responseData.results || responseData
            setSystemSettings(systemSettingsData)

            // Initialize system form data
            const initialSystemData: Record<string, string> = {}
            systemSettingsData.forEach((setting: SystemSetting) => {
              initialSystemData[setting.key] = setting.value
            })
            setSystemFormData(initialSystemData)
          } catch (systemError) {
            console.error('Error fetching system settings:', systemError)
            setSystemError('Failed to load system settings')
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchSettings()
    }
  }, [user])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // In a real implementation, you'd call:
      // await api.patch('/api/user/settings/', formData)

      // For now, just simulate saving
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update local settings
      setSettings({ ...settings!, ...formData })

    } catch (error) {
      console.error('Error saving settings:', error)
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSystemInputChange = (key: string, value: string) => {
    setSystemFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSystemSave = async () => {
    try {
      setSystemSaving(true)
      setSystemError(null)

      // Prepare settings data for bulk update
      const settingsToUpdate = systemSettings.map(setting => ({
        key: setting.key,
        value: systemFormData[setting.key] || setting.value,
        value_type: setting.value_type,
        description: setting.description
      }))

      await api.post('/api/core/settings/bulk_update/', settingsToUpdate)

      // Refresh system settings
      const updatedResponse = await api.get('/api/core/settings/')
      const responseData = updatedResponse as any
      const updatedSettings = responseData.results || updatedResponse
      setSystemSettings(updatedSettings)

    } catch (error) {
      console.error('Error saving system settings:', error)
      setSystemError('Failed to save system settings')
    } finally {
      setSystemSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure application preferences.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Preferences</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-xl grid-cols-1 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure application preferences.</p>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl grid-cols-1 gap-4">
          <div>
            <Label htmlFor="accent">Accent Color</Label>
            <Input
              id="accent"
              type="color"
              value={formData.accent_color}
              onChange={(e) => handleInputChange('accent_color', e.target.value)}
              placeholder="#2E7DFF"
            />
          </div>
          <div>
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              value={formData.logo_url}
              onChange={(e) => handleInputChange('logo_url', e.target.value)}
              placeholder="/logo.svg"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notifications">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications in the app</p>
            </div>
            <input
              type="checkbox"
              id="notifications"
              checked={formData.notifications_enabled}
              onChange={(e) => handleInputChange('notifications_enabled', e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-alerts">Email Alerts</Label>
              <p className="text-sm text-muted-foreground">Receive important alerts via email</p>
            </div>
            <input
              type="checkbox"
              id="email-alerts"
              checked={formData.email_alerts}
              onChange={(e) => handleInputChange('email_alerts', e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl grid-cols-1 gap-4">
          <div>
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.timezone}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl grid-cols-1 gap-4">
          <div>
            <Label>Username</Label>
            <Input value={user?.username || ''} disabled />
          </div>
          <div>
            <Label>Email</Label>
            <Input value="user@example.com" disabled />
          </div>
          <div>
            <Label>Role</Label>
            <Input value={user?.role || ''} disabled />
          </div>
        </CardContent>
      </Card>

      {/* System Settings - Only for Admin users */}
      {user?.role === 'ADMIN' && (
        <>
          {systemError && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-destructive">{systemError}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">Configure system-wide settings and thresholds</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {systemSettings.map((setting) => (
                <div key={setting.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={setting.key} className="text-sm font-medium">
                      {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {setting.value_type}
                    </span>
                  </div>

                  {setting.value_type === 'boolean' ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={setting.key}
                        checked={systemFormData[setting.key]?.toLowerCase() === 'true'}
                        onChange={(e) => handleSystemInputChange(setting.key, e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={setting.key} className="text-sm">
                        {systemFormData[setting.key]?.toLowerCase() === 'true' ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  ) : (
                    <Input
                      id={setting.key}
                      type={setting.value_type === 'decimal' || setting.value_type === 'integer' ? 'number' : 'text'}
                      value={systemFormData[setting.key] || ''}
                      onChange={(e) => handleSystemInputChange(setting.key, e.target.value)}
                      placeholder={`Enter ${setting.key.toLowerCase().replace(/_/g, ' ')}`}
                      step={setting.value_type === 'decimal' ? '0.01' : undefined}
                    />
                  )}

                  {setting.description && (
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  )}

                  {setting.updated_by_name && (
                    <p className="text-xs text-muted-foreground">
                      Last updated by {setting.updated_by_name} on {new Date(setting.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end space-x-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save User Settings'}
        </Button>

        {user?.role === 'ADMIN' && (
          <Button
            onClick={handleSystemSave}
            disabled={systemSaving}
            variant="outline"
          >
            {systemSaving ? 'Saving...' : 'Save System Settings'}
          </Button>
        )}
      </div>
    </div>
  )
}
