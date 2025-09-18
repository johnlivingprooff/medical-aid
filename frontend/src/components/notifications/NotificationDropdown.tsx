import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { notificationApi } from '../../lib/api';
import { Notification } from '../../types/models';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDropdownProps {
  onNotificationClick?: (notification: Notification) => void;
  onViewAllClick?: () => void;
  onSettingsClick?: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  onNotificationClick,
  onViewAllClick,
  onSettingsClick
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRecentNotifications();
    }
  }, [isOpen]);

  const loadUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadRecentNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getNotifications({
        page_size: 5,
        status: 'SENT,DELIVERED'
      });
      setNotifications(response.results);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await notificationApi.markRead([notification.id]);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, status: 'READ', is_read: true }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    onNotificationClick?.(notification);
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, status: 'READ', is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CLAIM_STATUS_UPDATE':
        return '📋';
      case 'CREDENTIALING_UPDATE':
        return '✅';
      case 'SYSTEM_MAINTENANCE':
        return '⚡';
      default:
        return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <Card className="absolute right-0 top-12 w-80 shadow-lg border z-50">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMarkAllRead}
                    className="text-xs"
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onSettingsClick?.();
                    setIsOpen(false);
                  }}
                  className="text-xs"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Notifications List */}
            <ScrollArea className="max-h-96">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-50 cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0">
                          {getNotificationIcon(notification.notification_type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                !notification.is_read ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </p>
                              <p className={`text-xs mt-1 line-clamp-2 ${
                                !notification.is_read ? 'text-blue-700' : 'text-gray-600'
                              }`}>
                                {notification.message.length > 80
                                  ? `${notification.message.substring(0, 80)}...`
                                  : notification.message
                                }
                              </p>
                            </div>
                            <Badge
                              className={`text-xs flex-shrink-0 ${getPriorityColor(notification.priority)}`}
                            >
                              {notification.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  onViewAllClick?.();
                  setIsOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};