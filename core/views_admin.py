from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.db import connection
from claims.models import Patient, Claim
from accounts.models import ProviderProfile
from schemes.models import SchemeCategory
from drf_spectacular.utils import extend_schema, OpenApiResponse
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class IsAdminOnly(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) == 'ADMIN'


class AdminStatsView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(
        summary="Get admin statistics",
        description="Returns comprehensive system statistics for admin users",
        responses={
            200: OpenApiResponse(description='Admin statistics data'),
            403: OpenApiResponse(description='Access denied - admin only'),
        }
    )
    def get(self, request):
        try:
            # Get basic counts
            total_users = User.objects.count()
            total_patients = Patient.objects.count()
            total_providers = ProviderProfile.objects.count()
            total_claims = Claim.objects.count()
            total_schemes = SchemeCategory.objects.count()

            # Get claim status breakdown
            claim_stats = Claim.objects.aggregate(
                pending=Count('id', filter=Q(status='PENDING')),
                approved=Count('id', filter=Q(status='APPROVED')),
                rejected=Count('id', filter=Q(status='REJECTED')),
                processing=Count('id', filter=Q(status='PROCESSING')),
                investigating=Count('id', filter=Q(status='INVESTIGATING'))
            )

            # Get user role breakdown
            user_roles = User.objects.values('role').annotate(count=Count('id'))
            role_breakdown = {role['role'] or 'UNASSIGNED': role['count'] for role in user_roles}

            # Get patient status breakdown
            patient_stats = Patient.objects.aggregate(
                active=Count('id', filter=Q(status='ACTIVE')),
                inactive=Count('id', filter=Q(status='INACTIVE')),
                suspended=Count('id', filter=Q(status='SUSPENDED'))
            )

            # Calculate system health based on various factors
            system_health = self._calculate_system_health(claim_stats, patient_stats, total_users)

            # Get recent activity counts
            recent_claims = Claim.objects.filter(
                date_submitted__gte=request.user.last_login
            ).count() if request.user.last_login else 0

            return Response({
                'total_users': total_users,
                'total_patients': total_patients,
                'total_providers': total_providers,
                'total_claims': total_claims,
                'total_schemes': total_schemes,
                'system_health': system_health,
                'claim_stats': claim_stats,
                'role_breakdown': role_breakdown,
                'patient_stats': patient_stats,
                'recent_claims': recent_claims,
                'database_status': self._check_database_health()
            })

        except Exception as e:
            logger.error(f"Error fetching admin stats: {e}")
            return Response({
                'error': 'Failed to fetch admin statistics',
                'system_health': 'error'
            }, status=500)

    def _calculate_system_health(self, claim_stats, patient_stats, total_users):
        """Calculate system health based on various metrics"""
        issues = []
        
        # Check for high number of pending claims
        pending_ratio = claim_stats['pending'] / max(claim_stats['pending'] + claim_stats['approved'] + claim_stats['rejected'], 1)
        if pending_ratio > 0.3:  # More than 30% pending
            issues.append('high_pending_claims')
        
        # Check for inactive patients
        inactive_ratio = patient_stats['inactive'] / max(sum(patient_stats.values()), 1)
        if inactive_ratio > 0.2:  # More than 20% inactive
            issues.append('high_inactive_patients')
        
        # Check if there are any users at all
        if total_users < 5:
            issues.append('low_user_count')
        
        if len(issues) >= 2:
            return 'error'
        elif len(issues) == 1:
            return 'warning'
        else:
            return 'healthy'

    def _check_database_health(self):
        """Basic database health check"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                return 'connected'
        except Exception:
            return 'error'


class AdminActionsView(APIView):
    permission_classes = [IsAdminOnly]

    @extend_schema(
        summary="Perform admin actions",
        description="Execute various admin actions like data export, system maintenance",
        responses={
            200: OpenApiResponse(description='Action completed successfully'),
            403: OpenApiResponse(description='Access denied - admin only'),
        }
    )
    def post(self, request):
        action = request.data.get('action')
        
        if action == 'reset_demo_data':
            return self._reset_demo_data()
        elif action == 'export_data':
            return self._export_system_data()
        elif action == 'generate_reports':
            return self._generate_reports()
        else:
            return Response({
                'error': 'Unknown action',
                'available_actions': ['reset_demo_data', 'export_data', 'generate_reports']
            }, status=400)

    def _reset_demo_data(self):
        """Reset demo data (in production, this should be more sophisticated)"""
        try:
            # For safety, we'll just return a success message
            # In a real implementation, you'd want to backup data first
            return Response({
                'success': True,
                'message': 'Demo data reset initiated. This would normally recreate seed data.',
                'note': 'In production, this action would backup existing data before reset.'
            })
        except Exception as e:
            logger.error(f"Error resetting demo data: {e}")
            return Response({'error': 'Failed to reset demo data'}, status=500)

    def _export_system_data(self):
        """Export system data"""
        try:
            from django.utils import timezone
            # Generate export summary
            summary = {
                'users': User.objects.count(),
                'patients': Patient.objects.count(),
                'claims': Claim.objects.count(),
                'providers': ProviderProfile.objects.count(),
                'export_timestamp': timezone.now().isoformat()
            }
            
            return Response({
                'success': True,
                'message': 'Data export prepared. In a real system, this would generate downloadable files.',
                'summary': summary,
                'note': 'Export functionality would normally provide CSV/JSON downloads.'
            })
        except Exception as e:
            logger.error(f"Error exporting data: {e}")
            return Response({'error': 'Failed to export data'}, status=500)

    def _generate_reports(self):
        """Generate comprehensive reports"""
        try:
            return Response({
                'success': True,
                'message': 'Reports generation initiated.',
                'reports': [
                    'User Activity Report',
                    'Claims Summary Report', 
                    'Provider Performance Report',
                    'System Health Report'
                ],
                'note': 'In production, this would generate detailed PDF/Excel reports.'
            })
        except Exception as e:
            logger.error(f"Error generating reports: {e}")
            return Response({'error': 'Failed to generate reports'}, status=500)
