import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CreditCard, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { billingApi, subscriptionBillingApi } from '@/lib/api'
import type { SubscriptionInvoice, PaymentMethod } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface PaymentProcessorProps {
  invoiceId?: number;
  onPaymentComplete?: () => void;
  className?: string;
}

export function PaymentProcessor({ invoiceId, onPaymentComplete, className }: PaymentProcessorProps) {
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (invoiceId) {
      loadData()
    }
  }, [invoiceId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [invoiceResponse, paymentMethodsResponse] = await Promise.all([
        subscriptionBillingApi.getInvoice(invoiceId!),
        billingApi.getPaymentMethods()
      ])

      setInvoice(invoiceResponse)
      setPaymentMethods(paymentMethodsResponse)

      // Auto-select default payment method
      const defaultMethod = paymentMethodsResponse.find((pm: PaymentMethod) => pm.is_default)
      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payment data')
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!invoice || !selectedPaymentMethod) return

    try {
      setProcessing(true)
      setError(null)

      const paymentData = {
        invoice_id: invoice.id,
        payment_method_id: selectedPaymentMethod.id,
        amount: invoice.amount
      }

      const response = await billingApi.createPayment(paymentData)

      setSuccess(true)
      if (onPaymentComplete) {
        onPaymentComplete()
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed')
    } finally {
      setProcessing(false)
    }
  }

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    switch (method.payment_type) {
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return `•••• •••• •••• ${method.card_number_masked} (${method.card_holder_name})`
      case 'PAYPAL':
        return `PayPal: ${method.paypal_email}`
      case 'BANK_ACCOUNT':
        return `Bank: ••••${method.account_number_masked}`
      default:
        return method.payment_type
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Process Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-32" />
        </CardContent>
      </Card>
    )
  }

  if (!invoice) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Process Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No invoice selected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            Payment Successful
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">Payment Completed</h3>
            <p className="mb-4 text-muted-foreground">
              Your payment of {formatCurrency(invoice.total_amount || invoice.amount)} has been processed successfully.
            </p>
            <div className="text-sm text-muted-foreground">
              Invoice: {invoice.invoice_number}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Process Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Summary */}
        <div className="p-4 rounded-lg bg-muted/50">
          <h4 className="mb-2 font-medium">Invoice Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Invoice:</span>
              <span className="ml-2 font-medium">{invoice.invoice_number}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Amount:</span>
              <span className="ml-2 font-medium">{formatCurrency(invoice.total_amount || invoice.amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Due Date:</span>
              <span className="ml-2">{invoice.due_date}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className="ml-2">
                <Badge variant={invoice?.status === 'PAID' ? 'default' : 'outline'}>
                  {invoice.status}
                </Badge>
              </span>
            </div>
          </div>
        </div>

        {invoice?.status === 'PAID' ? (
          <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-green-800">This invoice has already been paid.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Payment Method Selection */}
            <div>
              <h4 className="mb-3 font-medium">Select Payment Method</h4>
              {!paymentMethods.length ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No payment methods available</p>
                  <p className="text-sm">Please add a payment method first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPaymentMethod?.id === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPaymentMethod(method)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {getPaymentMethodDisplay(method)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {method.payment_type.replace('_', ' ')}
                            {method.is_default && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                        </div>
                        {selectedPaymentMethod?.id === method.id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Payment Button */}
            <div className="flex justify-end">
              <Button
                onClick={handlePayment}
                disabled={!selectedPaymentMethod || processing || (invoice && (invoice as SubscriptionInvoice).status === 'PAID')}
                size="lg"
              >
                {processing ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {formatCurrency(invoice.total_amount || invoice.amount)}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}