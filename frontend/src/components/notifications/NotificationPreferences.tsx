import React, { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Monitor, Clock } from 'lucide-react';
import { notificationApi } from '../../lib/api';
import { NotificationPreference } from '../../types/models';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';

interface NotificationPreferencesProps {
  className?: string;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  className
}) => {
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await notificationApi.getPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const updated = await notificationApi.updatePreferences(preferences);
      setPreferences(updated);
      toast.success('Notification preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreference, value: any) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Failed to load preferences</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel Preferences */}
        <div>
          <h3 className="text-lg font-medium mb-4">Notification Channels</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-500" />
                <div>
                  <Label htmlFor="email-enabled" className="text-sm font-medium">
                    Email Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Checkbox
                id="email-enabled"
                checked={preferences.email_enabled}
                onChange={(checked) => updatePreference('email_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-green-500" />
                <div>
                  <Label htmlFor="sms-enabled" className="text-sm font-medium">
                    SMS Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive notifications via SMS
                  </p>
                </div>
              </div>
              <Checkbox
                id="sms-enabled"
                checked={preferences.sms_enabled}
                onChange={(checked) => updatePreference('sms_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 text-purple-500" />
                <div>
                  <Label htmlFor="push-enabled" className="text-sm font-medium">
                    Push Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive push notifications in browser
                  </p>
                </div>
              </div>
              <Checkbox
                id="push-enabled"
                checked={preferences.push_enabled}
                onChange={(checked) => updatePreference('push_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-500" />
                <div>
                  <Label htmlFor="in-app-enabled" className="text-sm font-medium">
                    In-App Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive notifications within the application
                  </p>
                </div>
              </div>
              <Checkbox
                id="in-app-enabled"
                checked={preferences.in_app_enabled}
                onChange={(checked) => updatePreference('in_app_enabled', checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Notification Types */}
        <div>
          <h3 className="text-lg font-medium mb-4">Notification Types</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="claims-enabled" className="text-sm font-medium">
                  Claim Updates
                </Label>
                <p className="text-xs text-gray-500">
                  Notifications about claim status changes
                </p>
              </div>
              <Checkbox
                id="claims-enabled"
                checked={preferences.claim_updates_enabled}
                onChange={(checked) => updatePreference('claim_updates_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="credentialing-enabled" className="text-sm font-medium">
                  Credentialing Updates
                </Label>
                <p className="text-xs text-gray-500">
                  Notifications about credentialing status changes
                </p>
              </div>
              <Checkbox
                id="credentialing-enabled"
                checked={preferences.credentialing_updates_enabled}
                onChange={(checked) => updatePreference('credentialing_updates_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="payments-enabled" className="text-sm font-medium">
                  Payment Updates
                </Label>
                <p className="text-xs text-gray-500">
                  Notifications about payment processing
                </p>
              </div>
              <Checkbox
                id="payments-enabled"
                checked={preferences.payment_updates_enabled}
                onChange={(checked) => updatePreference('payment_updates_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="announcements-enabled" className="text-sm font-medium">
                  System Announcements
                </Label>
                <p className="text-xs text-gray-500">
                  Important system announcements and updates
                </p>
              </div>
              <Checkbox
                id="announcements-enabled"
                checked={preferences.system_announcements_enabled}
                onChange={(checked) => updatePreference('system_announcements_enabled', checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quiet Hours
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quiet-start" className="text-sm font-medium">
                Start Time
              </Label>
              <Input
                id="quiet-start"
                type="time"
                value={preferences.quiet_hours_start || ''}
                onChange={(e) => updatePreference('quiet_hours_start', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quiet-end" className="text-sm font-medium">
                End Time
              </Label>
              <Input
                id="quiet-end"
                type="time"
                value={preferences.quiet_hours_end || ''}
                onChange={(e) => updatePreference('quiet_hours_end', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            During quiet hours, you'll only receive urgent notifications
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="min-w-24"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};