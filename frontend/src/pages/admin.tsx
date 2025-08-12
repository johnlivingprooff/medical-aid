import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Database, AlertTriangle, Activity } from 'lucide-react'

interface AdminStats {
  total_users: number
  total_patients: number
  total_providers: number
  total_claims: number
  system_health: 'healthy' | 'warning' | 'error'
}

export default function Admin() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // In a real implementation, you'd have an admin stats endpoint
        // For now, simulate some admin data
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const mockStats: AdminStats = {
          total_users: 25,
          total_patients: 18,
          total_providers: 7,
          total_claims: 342,
          system_health: 'healthy'
        }
        
        setStats(mockStats)
      } catch (error) {
        console.error('Error fetching admin stats:', error)
        setError('Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }

    if (user?.role === 'ADMIN') {
      fetchAdminStats()
    }
  }, [user])

  const handleResetData = async () => {
    if (window.confirm('Are you sure you want to reset all demo data? This action cannot be undone.')) {
      try {
        // In a real implementation, you'd call: await api.post('/api/admin/reset-data/')
        alert('Data reset functionality would be implemented here')
      } catch (error) {
        console.error('Error resetting data:', error)
      }
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-6">
        <div>
          <h1>Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access denied.</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-destructive">You don't have permission to access this page.</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">System administration and management tools.</p>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Patients</p>
                    <p className="text-2xl font-bold">{stats?.total_patients || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Providers</p>
                    <p className="text-2xl font-bold">{stats?.total_providers || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Claims</p>
                    <p className="text-2xl font-bold">{stats?.total_claims || 0}</p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={
                stats?.system_health === 'healthy' ? 'success' :
                stats?.system_health === 'warning' ? 'warning' : 'destructive'
              }>
                {stats?.system_health === 'healthy' ? 'All Systems Operational' :
                 stats?.system_health === 'warning' ? 'Minor Issues Detected' : 'Critical Issues'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last checked: {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Admin Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Data Management</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Export System Data</p>
                  <p className="text-xs text-muted-foreground">Generate CSV export of all system data</p>
                </div>
                <Button variant="outline" size="sm">Export</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Generate Reports</p>
                  <p className="text-xs text-muted-foreground">Create comprehensive system reports</p>
                </div>
                <Button variant="outline" size="sm">Generate</Button>
              </div>
            </div>
          </div>
          
          <hr />
          
          <div>
            <h4 className="font-medium mb-2 text-destructive">Danger Zone</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset Demo Data</p>
                  <p className="text-xs text-muted-foreground">Reset all demo data and rebuild analytics. Irreversible in production.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleResetData}>
                  Reset & Rebuild
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
