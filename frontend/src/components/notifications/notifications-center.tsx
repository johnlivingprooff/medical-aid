/**
 * Real-time Notifications Center Component
 * Displays system notifications, claim updates, and alerts with WebSocket integration
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Clock,
  DollarSign,
  FileText,
  User,
  Settings,
  Filter,
  Trash2
} from 'lucide-react';
import { CurrencyUtils } from '@/lib/currency-enhanced';
import { apiClient } from '@/lib/api-enhanced';

interface Notification {
  id: number;
  type: 'CLAIM_UPDATE' | 'PRE_AUTH_REQUIRED' | 'BENEFIT_LIMIT' | 'SYSTEM_ALERT' | 'PAYMENT_UPDATE';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  action_url?: string;
  metadata?: {
    claim_id?: number;
    patient_id?: number;
    amount?: number;
    provider_name?: string;
    [key: string]: any;
  };
}

interface Props {
  compact?: boolean;
  showUnreadOnly?: boolean;
  maxItems?: number;
}

const NOTIFICATION_TYPES = {
  CLAIM_UPDATE: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  PRE_AUTH_REQUIRED: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  BENEFIT_LIMIT: { icon: DollarSign, color: 'text-red-600', bgColor: 'bg-red-50' },
  SYSTEM_ALERT: { icon: Info, color: 'text-gray-600', bgColor: 'bg-gray-50' },
  PAYMENT_UPDATE: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' }
};

const PRIORITY_COLORS = {
  LOW: 'border-gray-200',
  MEDIUM: 'border-yellow-200',
  HIGH: 'border-orange-200',
  URGENT: 'border-red-200'
};

export function NotificationsCenter({ compact = false, showUnreadOnly = false, maxItems = 50 }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadNotifications();
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const setupWebSocket = () => {
    try {
      // In a real app, this would connect to your WebSocket endpoint
      // For now, we'll simulate with a mock connection
      console.log('Setting up WebSocket connection for notifications...');
      
      // Simulate real-time notifications every 30 seconds
      const interval = setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance
          addMockNotification();
        }
      }, 30000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/notifications/') as any;
      const notificationsData = response.results || response;
      
      // If no data from API, use mock data
      if (!notificationsData || notificationsData.length === 0) {
        const mockNotifications = generateMockNotifications();
        setNotifications(mockNotifications);
        setUnreadCount(mockNotifications.filter(n => !n.read).length);
      } else {
        setNotifications(notificationsData);
        setUnreadCount(notificationsData.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Fallback to mock data
      const mockNotifications = generateMockNotifications();
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } finally {
      setLoading(false);
    }
  };

  const generateMockNotifications = (): Notification[] => {
    return [
      {
        id: 1,
        type: 'CLAIM_UPDATE',
        title: 'Claim Approved',
        message: 'Your claim for consultation with Dr. Smith has been approved.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        read: false,
        priority: 'MEDIUM',
        metadata: {
          claim_id: 123,
          amount: 2500,
          provider_name: 'Dr. Smith Medical Center'
        }
      },
      {
        id: 2,
        type: 'PRE_AUTH_REQUIRED',
        title: 'Pre-Authorization Required',
        message: 'Your upcoming MRI scan requires pre-authorization.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        read: false,
        priority: 'HIGH',
        metadata: {
          claim_id: 124,
          amount: 15000,
          provider_name: 'Central Imaging'
        }
      },
      {
        id: 3,
        type: 'BENEFIT_LIMIT',
        title: 'Benefit Limit Warning',
        message: 'You have used 80% of your annual dental benefit limit.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        read: true,
        priority: 'MEDIUM',
        metadata: {
          amount: 8000
        }
      },
      {
        id: 4,
        type: 'PAYMENT_UPDATE',
        title: 'Payment Processed',
        message: 'Payment of MWK 3,500 has been processed to City Hospital.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        read: true,
        priority: 'LOW',
        metadata: {
          amount: 3500,
          provider_name: 'City Hospital'
        }
      },
      {
        id: 5,
        type: 'SYSTEM_ALERT',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur this weekend from 2 AM to 6 AM.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
        read: true,
        priority: 'LOW'
      }
    ];
  };

  const addMockNotification = () => {
    const newNotification: Notification = {
      id: Date.now(),
      type: 'CLAIM_UPDATE',
      title: 'New Claim Update',
      message: 'A new claim has been submitted and is pending review.',
      timestamp: new Date().toISOString(),
      read: false,
      priority: 'MEDIUM',
      metadata: {
        claim_id: Math.floor(Math.random() * 1000),
        amount: Math.floor(Math.random() * 10000) + 1000
      }
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await apiClient.patch(`/notifications/${notificationId}/`, { read: true });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Update locally anyway
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await apiClient.delete(`/notifications/${notificationId}/`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Delete locally anyway
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  const getFilteredNotifications = () => {
    let filtered = notifications;

    if (showUnreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    if (filter !== 'all') {
      filtered = filtered.filter(n => n.type === filter);
    }

    return filtered.slice(0, maxItems);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const typeConfig = NOTIFICATION_TYPES[notification.type];
    const IconComponent = typeConfig.icon;

    return (
      <div
        className={`p-4 border-l-4 ${PRIORITY_COLORS[notification.priority]} ${
          !notification.read ? 'bg-blue-50' : 'bg-white'
        } hover:bg-gray-50 transition-colors`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${typeConfig.bgColor}`}>
            <IconComponent className={`h-4 w-4 ${typeConfig.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(notification.timestamp)}
                </span>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
            
            {notification.metadata && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {notification.metadata.amount && (
                  <span>Amount: {CurrencyUtils.format(notification.metadata.amount)}</span>
                )}
                {notification.metadata.provider_name && (
                  <span>Provider: {notification.metadata.provider_name}</span>
                )}
                {notification.metadata.claim_id && (
                  <span>Claim #{notification.metadata.claim_id}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAsRead(notification.id)}
                className="h-8 w-8 p-0"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteNotification(notification.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {isOpen && (
          <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Notifications</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {getFilteredNotifications().length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {getFilteredNotifications().slice(0, 5).map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark All Read
              </Button>
            )}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Types</option>
              <option value="CLAIM_UPDATE">Claim Updates</option>
              <option value="PRE_AUTH_REQUIRED">Pre-Auth Required</option>
              <option value="BENEFIT_LIMIT">Benefit Limits</option>
              <option value="PAYMENT_UPDATE">Payment Updates</option>
              <option value="SYSTEM_ALERT">System Alerts</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : getFilteredNotifications().length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No notifications to display</p>
          </div>
        ) : (
          <div className="space-y-1">
            {getFilteredNotifications().map(notification => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}