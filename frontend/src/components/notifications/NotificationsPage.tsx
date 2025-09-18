import React, { useState } from 'react';
import { Bell, Settings, Plus } from 'lucide-react';
import { NotificationList } from './NotificationList';
import { NotificationPreferences } from './NotificationPreferences';
import { Notification } from '../../types/models';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

interface NotificationsPageProps {
  onNotificationClick?: (notification: Notification) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onNotificationClick
}) => {
  const [activeTab, setActiveTab] = useState('notifications');
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-600" />
            Notifications
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your notifications and communication preferences
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Preferences
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Notification Preferences</DialogTitle>
              </DialogHeader>
              <NotificationPreferences />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications">All Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationList
            onNotificationClick={handleNotificationClick}
            showBulkActions={true}
            compact={false}
            maxHeight="calc(100vh - 300px)"
          />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
};