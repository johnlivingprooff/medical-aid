/**
 * Enhanced Dashboard Page with New Components
 * Integrates the benefit utilization dashboard and notifications center
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BenefitUtilizationDashboard } from '@/components/dashboard/benefit-utilization-dashboard';
import { NotificationsCenter } from '@/components/notifications/notifications-center';

export function EnhancedDashboard() {
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1); // Mock patient ID

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Enhanced Medical Aid Dashboard</h1>
        <div className="flex items-center gap-4">
          <NotificationsCenter compact />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Full Benefit Utilization Dashboard */}
        <div>
          <BenefitUtilizationDashboard 
            patientId={selectedPatientId}
            showAllBenefits={true}
          />
        </div>

        {/* Full Notifications Center */}
        <div>
          <NotificationsCenter />
        </div>
      </div>

      {/* Compact versions for testing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BenefitUtilizationDashboard 
          patientId={selectedPatientId}
          compact={true}
        />
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              This enhanced dashboard demonstrates the integration of medical aid business logic
              into the frontend components, providing a comprehensive view of patient benefits
              and real-time notifications.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}