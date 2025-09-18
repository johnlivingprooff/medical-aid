import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Plus, Trash2, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { billingApi, subscriptionBillingApi } from '@/lib/api'
import type { PaymentMethod } from '@/types/models'
import { Skeleton } from '@/components/ui/skeleton'

interface PaymentMethodManagerProps {
  patientId?: number;
  className?: string;
}

export function PaymentMethodManager({ patientId, className }: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (patientId) {
      loadPaymentMethods()
    }
  }, [patientId])

  const loadPaymentMethods = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await billingApi.getPaymentMethods()
      setPaymentMethods(response)
    } catch (err: any) {
      setError(err.message || 'Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPaymentMethod = async (formData: any) => {
    try {
      setSaving(true)
      await billingApi.createPaymentMethod(formData)
      setShowAddDialog(false)
      await loadPaymentMethods()
    } catch (err: any) {
      throw new Error(err.message || 'Failed to add payment method')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (paymentMethodId: number) => {
    try {
      await subscriptionBillingApi.setDefaultPaymentMethod(paymentMethodId)
      await loadPaymentMethods()
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method')
    }
  }

  const handleDeletePaymentMethod = async (paymentMethodId: number) => {
    try {
      await subscriptionBillingApi.deletePaymentMethod(paymentMethodId)
      await loadPaymentMethods()
    } catch (err: any) {
      setError(err.message || 'Failed to delete payment method')
    }
  }

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return <CreditCard className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="w-full h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </CardTitle>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Payment Method
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payment Method</DialogTitle>
              </DialogHeader>
              <AddPaymentMethodForm
                onSubmit={handleAddPaymentMethod}
                onCancel={() => setShowAddDialog(false)}
                saving={saving}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive mb-4">{error}</div>
        )}

        {!paymentMethods.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No payment methods added yet</p>
            <p className="text-sm">Add a payment method to enable automatic billing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getPaymentMethodIcon(method.payment_type)}
                  <div>
                    <div className="font-medium">
                      {method.card_holder_name || 'Payment Method'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {method.card_number_masked && `•••• •••• •••• ${method.card_number_masked}`}
                      {method.paypal_email && method.paypal_email}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {method.payment_type.replace('_', ' ')}
                      </Badge>
                      {method.is_default && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePaymentMethod(method.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AddPaymentMethodFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}

function AddPaymentMethodForm({ onSubmit, onCancel, saving }: AddPaymentMethodFormProps) {
  const [formData, setFormData] = useState({
    payment_type: 'CREDIT_CARD',
    card_holder_name: '',
    card_number_masked: '',
    expiry_month: '',
    expiry_year: '',
    paypal_email: '',
    is_default: false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="payment_type">Payment Type</Label>
        <Select
          value={formData.payment_type}
          onValueChange={(value) => handleChange('payment_type', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
            <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
            <SelectItem value="BANK_ACCOUNT">Bank Account</SelectItem>
            <SelectItem value="PAYPAL">PayPal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(formData.payment_type === 'CREDIT_CARD' || formData.payment_type === 'DEBIT_CARD') && (
        <>
          <div>
            <Label htmlFor="card_holder_name">Card Holder Name</Label>
            <Input
              id="card_holder_name"
              value={formData.card_holder_name}
              onChange={(e) => handleChange('card_holder_name', e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <Label htmlFor="card_number_masked">Card Number (Last 4 digits)</Label>
            <Input
              id="card_number_masked"
              value={formData.card_number_masked}
              onChange={(e) => handleChange('card_number_masked', e.target.value)}
              placeholder="1234"
              maxLength={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry_month">Expiry Month</Label>
              <Select
                value={formData.expiry_month}
                onValueChange={(value) => handleChange('expiry_month', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {String(i + 1).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expiry_year">Expiry Year</Label>
              <Select
                value={formData.expiry_year}
                onValueChange={(value) => handleChange('expiry_year', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() + i
                    return (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {formData.payment_type === 'PAYPAL' && (
        <div>
          <Label htmlFor="paypal_email">PayPal Email</Label>
          <Input
            id="paypal_email"
            type="email"
            value={formData.paypal_email}
            onChange={(e) => handleChange('paypal_email', e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_default"
          checked={formData.is_default}
          onChange={(e) => handleChange('is_default', e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="is_default">Set as default payment method</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  )
}