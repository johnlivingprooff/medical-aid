import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { api, reportsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { capitalizeFirst } from '@/lib/format-text'
import { Download, BarChart3, FileText } from 'lucide-react'

interface SchemeUsageReport {
  patient__scheme__name: string
  total_claims: number
  total_amount: number
}

interface DiseaseStatsReport {
  service_type: number
  service_type_name: string
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

    // Client-side CSV generation functions
    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    const exportSchemeUsageCSV = () => {
      try {
        let csv = 'Scheme Name,Total Claims,Total Amount\n'
        filteredSchemeUsage.forEach(item => {
          const schemeName = (item.patient__scheme__name || 'Unknown Scheme').replace(/,/g, ' ')
          csv += `"${schemeName}",${item.total_claims},${item.total_amount}\n`
        })
        downloadCSV('scheme_usage_report.csv', csv)
      } catch (error: any) {
        console.error('Error exporting CSV:', error)
        setError('Failed to export scheme usage report')
      }
    }

    const exportServiceTypeCSV = () => {
      try {
        let csv = 'Service Type,Total Claims\n'
        filteredDiseaseStats.forEach(item => {
          const serviceName = capitalizeFirst(item.service_type_name || 'Unknown Service').replace(/,/g, ' ')
          csv += `"${serviceName}",${item.total}\n`
        })
        downloadCSV('service_type_stats.csv', csv)
      } catch (error: any) {
        console.error('Error exporting CSV:', error)
        setError('Failed to export service type report')
      }
    }

    const exportDetailedClaimsCSV = async () => {
      try {
        setLoading(true)
        // Fetch detailed claims data
        const response = await api.get<{ results: any[] }>('/api/core/reports/detailed-claims/')
        const claims = response.results
      
        let csv = 'Claim ID,Member ID,Member Name,Scheme,Provider,Service Type,Cost,Status,Date Submitted\n'
        claims.forEach(claim => {
          const memberName = (claim.member_name || 'Unknown').replace(/,/g, ' ')
          const scheme = (claim.scheme || 'Unknown').replace(/,/g, ' ')
          const provider = (claim.provider || 'Unknown').replace(/,/g, ' ')
          const serviceType = (claim.service_type || 'Unknown').replace(/,/g, ' ')
          const dateSubmitted = claim.date_submitted ? new Date(claim.date_submitted).toLocaleString() : ''
        
          csv += `${claim.claim_id},"${claim.member_id}","${memberName}","${scheme}","${provider}","${serviceType}",${claim.cost},${claim.status},"${dateSubmitted}"\n`
        })
      
        downloadCSV('detailed_claims_report.csv', csv)
      } catch (error: any) {
        console.error('Error exporting CSV:', error)
        setError('Failed to export detailed claims report')
      } finally {
        setLoading(false)
      }
    }

  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medical Aid Reports</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header { margin-bottom: 20px; }
          .date { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Medical Aid Reports</h1>
          <p class="date">Generated on: ${new Date().toLocaleString()}</p>
        </div>
        
        <h2>Scheme Usage Report (Last 30 Days)</h2>
        <table>
          <thead>
            <tr>
              <th>Scheme Name</th>
              <th>Total Claims</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSchemeUsage.map(item => `
              <tr>
                <td>${item.patient__scheme__name || 'Unknown Scheme'}</td>
                <td>${item.total_claims}</td>
                <td>${formatCurrency(item.total_amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2>Service Type Statistics</h2>
        <table>
          <thead>
            <tr>
              <th>Service Type</th>
              <th>Total Claims</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDiseaseStats.map(item => `
              <tr>
                <td>${capitalizeFirst(item.service_type_name || 'Unknown Service')}</td>
                <td>${item.total}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    }
  }

  // Filter data based on search text
  const filteredSchemeUsage = schemeUsage.filter(item =>
    String(item.patient__scheme__name || '').toLowerCase().includes(filterText.toLowerCase())
  )

  const filteredDiseaseStats = diseaseStats.filter(item =>
    String(item.service_type_name || '').toLowerCase().includes(filterText.toLowerCase())
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
            <Button onClick={exportDetailedClaimsCSV} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Export Detailed Claims
            </Button>
            <Button onClick={exportSchemeUsageCSV} disabled={loading} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Scheme Stats CSV
            </Button>
            <Button onClick={exportServiceTypeCSV} disabled={loading} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Service Stats CSV
            </Button>
            <Button variant="outline" onClick={exportToPDF} disabled={loading}>
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
                    <p className="font-medium">{capitalizeFirst(item.service_type_name || 'Unknown Service')}</p>
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
