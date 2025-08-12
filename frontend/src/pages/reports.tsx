import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { Download, BarChart3, FileText } from 'lucide-react'

interface SchemeUsageReport {
  patient__scheme__name: string
  total_claims: number
  total_amount: number
}

interface DiseaseStatsReport {
  service_type: string
  total: number
}

export default function Reports() {
  const [schemeUsage, setSchemeUsage] = useState<SchemeUsageReport[]>([])
  const [diseaseStats, setDiseaseStats] = useState<DiseaseStatsReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        setError(null)

        const [schemeResponse, diseaseResponse] = await Promise.all([
          api.get<{ results: SchemeUsageReport[] }>('/api/core/reports/scheme-usage/'),
          api.get<{ results: DiseaseStatsReport[] }>('/api/core/reports/disease-stats/')
        ])

        setSchemeUsage(schemeResponse.results)
        setDiseaseStats(diseaseResponse.results)
      } catch (error) {
        console.error('Error fetching reports:', error)
        setError('Failed to load reports data')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  const exportSchemeUsageCSV = async () => {
    try {
      const response = await fetch('/api/core/reports/scheme-usage/?format=csv', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'scheme_usage_report.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
    }
  }

  // Filter data based on search text
  const filteredSchemeUsage = schemeUsage.filter(item =>
    String(item.patient__scheme__name || '').toLowerCase().includes(filterText.toLowerCase())
  )

  const filteredDiseaseStats = diseaseStats.filter(item =>
    String(item.service_type || '').toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1>Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Export and schedule reports.</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report toolbar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Input 
              placeholder="Filter by scheme or service type" 
              className="w-64" 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <Button onClick={exportSchemeUsageCSV} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" disabled>
              Schedule…
            </Button>
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

      {/* Scheme Usage Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scheme Usage Report (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSchemeUsage.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {filterText ? 'No schemes match your filter' : 'No scheme usage data available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSchemeUsage.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{item.patient__scheme__name || 'Unknown Scheme'}</p>
                    <p className="text-sm text-muted-foreground">Claims processed</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="info">{item.total_claims} claims</Badge>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">Total value</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disease/Service Type Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Service Type Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredDiseaseStats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {filterText ? 'No service types match your filter' : 'No service type data available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDiseaseStats.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{item.service_type || 'Unknown Service'}</p>
                    <p className="text-sm text-muted-foreground">Service category</p>
                  </div>
                  <Badge variant="info">{item.total} claims</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
