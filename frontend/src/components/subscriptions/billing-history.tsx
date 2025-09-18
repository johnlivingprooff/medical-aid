import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Download, Receipt, TrendingUp, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionBillingApi } from '@/lib/api'
import type { BillingHistory, SubscriptionInvoice, SubscriptionPayment } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface BillingHistoryComponentProps {
  patientId?: number;
  className?: string;
}

export function BillingHistoryComponent({ patientId, className }: BillingHistoryComponentProps) {
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([])
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([])
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'invoices' | 'payments'>('history')

  useEffect(() => {
    if (patientId) {
      loadBillingData()
    }
  }, [patientId])

  const loadBillingData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [historyResponse, invoicesResponse, paymentsResponse] = await Promise.all([
        subscriptionBillingApi.getBillingHistory(),
        subscriptionBillingApi.getInvoices(),
        subscriptionBillingApi.getPayments()
      ])

      setBillingHistory(historyResponse)
      setInvoices(invoicesResponse)
      setPayments(paymentsResponse)
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'PAYMENT_COMPLETED':
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'PAYMENT_FAILED':
        return <TrendingDown className="w-4 h-4 text-red-500" />
      case 'INVOICE_CREATED':
        return <Receipt className="w-4 h-4 text-blue-500" />
      case 'SUBSCRIPTION_RENEWED':
        return <Calendar className="w-4 h-4 text-purple-500" />
      default:
        return <Receipt className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'PAYMENT_COMPLETED':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'PAYMENT_FAILED':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'INVOICE_CREATED':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'SUBSCRIPTION_RENEWED':
        return 'text-purple-700 bg-purple-50 border-purple-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'PAID':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>
      case 'SENT':
        return <Badge variant="outline">Sent</Badge>
      case 'OVERDUE':
        return <Badge variant="destructive">Overdue</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-full h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Billing History
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            Activity
          </Button>
          <Button
            variant={activeTab === 'invoices' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('invoices')}
          >
            Invoices ({invoices.length})
          </Button>
          <Button
            variant={activeTab === 'payments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('payments')}
          >
            Payments ({payments.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 text-sm text-destructive">{error}</div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {!billingHistory.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No billing activity yet</p>
              </div>
            ) : (
              billingHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 border rounded-lg"
                >
                  <div className="mt-1">
                    {getActionIcon(item.action || item.activity_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{(item.action || item.activity_type).replace('_', ' ')}</span>
                      {item.amount && (
                        <Badge variant="outline" className="text-xs">
                          {formatCurrency(item.amount)}
                        </Badge>
                      )}
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(item.timestamp || item.created_at).toLocaleDateString()}</span>
                      <span>{new Date(item.timestamp || item.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {!invoices.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
              </div>
            ) : (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{invoice.invoice_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.billing_start_date} to {invoice.billing_end_date}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Due: {invoice.due_date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(invoice.total_amount || invoice.amount)}</div>
                    <div className="mb-2">
                      {getStatusBadge(invoice.status)}
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            {!payments.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No payments found</p>
              </div>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{payment.payment_id}</div>
                    <div className="text-sm text-muted-foreground">
                      Invoice: {payment.invoice_detail?.invoice_number}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString()
                        : 'Not processed'
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(payment.amount)}</div>
                    <div className="mb-2">
                      {getStatusBadge(payment.status)}
                    </div>
                    {payment.transaction_id && (
                      <div className="text-xs text-muted-foreground">
                        TXN: {payment.transaction_id}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}