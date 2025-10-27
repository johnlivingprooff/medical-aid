/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, CheckCircle, AlertTriangle, Info, Trash2, Check, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/components/auth/auth-context'
import { useNavigate } from 'react-router-dom'

interface Notification {
  id: number
  title: string
  message: string
  html_message?: string
  type: string
  priority: string
  read: boolean
  created_at: string
  metadata?: {
    claim_id?: string
    member_id?: string
    service_type?: string
    claim_amount?: string
    approved_amount?: string
    member_responsibility?: string
    rejection_reason?: string
    approval_type?: string
    [key: string]: any
  }
}

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 border-gray-200',
  normal: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
}

const TYPE_LABELS = {
  CLAIM_STATUS_UPDATE: 'Claim Update',
  PRE_AUTH_REQUIRED: 'Pre-Authorization',
  BENEFIT_LIMIT: 'Benefit Limit',
  SYSTEM_ALERT: 'System',
  PAYMENT_UPDATE: 'Payment',
  CREDENTIALING_UPDATE: 'Credentialing',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await api.get<any>('/api/accounts/notifications/')
      const data = response.results ?? response ?? []
      setNotifications(data)
    } catch (error) {
      console.error('Failed to load notifications:', error)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/api/accounts/notifications/${id}/mark-read/`, {})
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/api/accounts/notifications/mark-all-read/', {})
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/api/accounts/notifications/${id}/`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id)
    }

    // Navigate to claim if applicable
    if (notification.metadata?.claim_id) {
      navigate('/claims')
    }
  }

  const filteredNotifications = notifications
    .filter(n => {
      if (filter === 'unread') return !n.read
      if (filter === 'read') return n.read
      return true
    })
    .filter(n => {
      if (typeFilter === 'all') return true
      return n.type === typeFilter
    })

  const unreadCount = notifications.filter(n => !n.read).length
  const uniqueTypes = [...new Set(notifications.map(n => n.type))]

  return (
    <div className="container max-w-5xl py-8 mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          {unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
            : 'All caught up!'}
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read">
              Read ({notifications.length - unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {uniqueTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-current border-r-transparent rounded-full animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading notifications...</p>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground">
              {filter === 'unread'
                ? "You don't have any unread notifications"
                : filter === 'read'
                ? "You don't have any read notifications"
                : "You don't have any notifications yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map(notification => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                !notification.read ? 'border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{notification.title}</CardTitle>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className={PRIORITY_COLORS[notification.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal}>
                        {notification.priority}
                      </Badge>
                      <Badge variant="outline">
                        {TYPE_LABELS[notification.type as keyof typeof TYPE_LABELS] || notification.type}
                      </Badge>
                      <span>{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{notification.message}</p>

                {/* Display metadata if available */}
                {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                  <div className="p-3 mt-3 rounded-md bg-muted/50">
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {notification.metadata.claim_id && (
                        <div>
                          <span className="font-medium">Claim ID:</span> {notification.metadata.claim_id}
                        </div>
                      )}
                      {notification.metadata.member_id && (
                        <div>
                          <span className="font-medium">Member:</span> {notification.metadata.member_id}
                        </div>
                      )}
                      {notification.metadata.service_type && (
                        <div>
                          <span className="font-medium">Service:</span> {notification.metadata.service_type}
                        </div>
                      )}
                      {notification.metadata.claim_amount && (
                        <div>
                          <span className="font-medium">Claim Amount:</span> R{parseFloat(notification.metadata.claim_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {notification.metadata.approved_amount && (
                        <div>
                          <span className="font-medium">Approved:</span> R{parseFloat(notification.metadata.approved_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {notification.metadata.member_responsibility && (
                        <div className="col-span-2">
                          <span className="font-medium">Member Responsibility:</span> R{parseFloat(notification.metadata.member_responsibility).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {notification.metadata.approval_type && (
                        <div>
                          <span className="font-medium">Type:</span>{' '}
                          <Badge variant="outline" className="text-xs">
                            {notification.metadata.approval_type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
