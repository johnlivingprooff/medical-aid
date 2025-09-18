import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, AlertCircle, Info, Mail, Smartphone, Zap } from 'lucide-react';
import { notificationApi } from '../../lib/api';
import { Notification, NotificationType, NotificationChannel, NotificationStatus } from '../../types/models';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { formatDistanceToNow } from 'date-fns';

interface NotificationListProps {
  onNotificationClick?: (notification: Notification) => void;
  showBulkActions?: boolean;
  compact?: boolean;
  maxHeight?: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  onNotificationClick,
  showBulkActions = true,
  compact = false,
  maxHeight = '600px'
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    currentPage: 1
  });

  useEffect(() => {
    loadNotifications();
  }, [filters, pagination.currentPage]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.currentPage,
        page_size: 20
      };

      if (filters.status) params.status = filters.status;
      if (filters.type) params.notification_type = filters.type;
      if (filters.priority) params.priority = filters.priority;

      const response = await notificationApi.getNotifications(params);
      setNotifications(response.results);
      setPagination({
        ...pagination,
        count: response.count,
        next: response.next,
        previous: response.previous
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationIds: number[]) => {
    try {
      await notificationApi.markRead(notificationIds);
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, status: 'READ' as NotificationStatus, is_read: true }
            : n
        )
      );
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, status: 'READ' as NotificationStatus, is_read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'CLAIM_STATUS_UPDATE':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'CREDENTIALING_UPDATE':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'SYSTEM_MAINTENANCE':
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case 'EMAIL':
        return <Mail className="w-3 h-3" />;
      case 'SMS':
        return <Smartphone className="w-3 h-3" />;
      case 'PUSH':
        return <Bell className="w-3 h-3" />;
      default:
        return <Info className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        notification.title.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-gray-50">
        <Input
          placeholder="Search notifications..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="max-w-xs"
        />
        <Select value={filters.status} onValueChange={(value: string) => setFilters(prev => ({ ...prev, status: value }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="READ">Read</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(value: string) => setFilters(prev => ({ ...prev, type: value }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="CLAIM_STATUS_UPDATE">Claim Update</SelectItem>
            <SelectItem value="CREDENTIALING_UPDATE">Credentialing</SelectItem>
            <SelectItem value="SYSTEM_MAINTENANCE">System</SelectItem>
            <SelectItem value="MEMBERSHIP_EXPIRING">Membership</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(value: string) => setFilters(prev => ({ ...prev, priority: value }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priority</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && selectedIds.length > 0 && (
        <div className="flex gap-2 p-3 rounded-lg bg-blue-50">
          <Button
            size="sm"
            onClick={() => handleMarkRead(selectedIds)}
            className="flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark {selectedIds.length} as Read
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Mark All Read */}
      {showBulkActions && notifications.some(n => !n.is_read) && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            className="flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All as Read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className={`space-y-2 overflow-y-auto`} style={{ maxHeight }}>
        {filteredNotifications.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No notifications found</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                !notification.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white'
              } ${compact ? 'p-3' : 'p-4'}`}
              onClick={() => onNotificationClick?.(notification)}
            >
              <CardContent className="p-0">
                <div className="flex items-start gap-3">
                  {showBulkActions && (
                    <Checkbox
                      checked={selectedIds.includes(notification.id)}
                      onChange={(checked: boolean) => {
                        if (checked) {
                          setSelectedIds(prev => [...prev, notification.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== notification.id));
                        }
                      }}
                      className="mt-1"
                    />
                  )}

                  <div className="flex-shrink-0">
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className={`font-medium ${!notification.is_read ? 'text-blue-900' : 'text-gray-900'}`}>
                          {notification.title}
                        </h4>
                        <p className={`text-sm mt-1 ${!notification.is_read ? 'text-blue-700' : 'text-gray-600'}`}>
                          {notification.message.length > 100
                            ? `${notification.message.substring(0, 100)}...`
                            : notification.message
                          }
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          {getChannelIcon(notification.channel)}
                          <span>{notification.channel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.count > 20 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={!pagination.previous}
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {pagination.currentPage} of {Math.ceil(pagination.count / 20)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!pagination.next}
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};