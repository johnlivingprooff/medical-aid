from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
import logging

from .models import SchemeCategory, SchemeBenefit, SubscriptionTier, MemberSubscription
from .models_audit import SchemeAuditLog
from claims.models import Patient, Claim
from accounts.models import ProviderNetworkMembership

logger = logging.getLogger(__name__)


class SchemeDeletionService:
    """
    Service for safely deleting schemes with proper validation,
    member migration, and comprehensive audit logging.
    
    Supports two deletion modes:
    1. DEACTIVATE: Soft delete - keeps all data, marks scheme as inactive
    2. CASCADE: Hard delete - removes all related data (dangerous)
    """
    
    class DeletionMode:
        DEACTIVATE = 'deactivate'
        CASCADE = 'cascade'
    
    def __init__(self, user, request=None):
        self.user = user
        self.request = request
        self.deletion_start_time = None
    
    def validate_deletion_eligibility(self, scheme: SchemeCategory, mode: str = DeletionMode.DEACTIVATE) -> Dict:
        """
        Validate if a scheme can be safely deleted and return impact assessment.
        
        Returns:
            Dict with validation results and impact data
        """
        logger.info(f"Validating deletion eligibility for scheme {scheme.id}: {scheme.name}")
        
        # Check for active members
        active_members = Patient.objects.filter(
            scheme=scheme,
            status=Patient.Status.ACTIVE
        ).select_related('user')
        
        # Check for active subscriptions
        active_subscriptions = MemberSubscription.objects.filter(
            tier__scheme=scheme,
            status=MemberSubscription.SubscriptionStatus.ACTIVE
        ).select_related('patient', 'tier')
        
        # Check for recent claims (last 30 days)
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        recent_claims = Claim.objects.filter(
            patient__scheme=scheme,
            date_submitted__gte=thirty_days_ago
        )
        
        # Check for pending claims
        pending_claims = Claim.objects.filter(
            patient__scheme=scheme,
            status__in=[
                Claim.Status.PENDING,
                Claim.Status.REQUIRES_PREAUTH,
                Claim.Status.INVESTIGATING
            ]
        )
        
        # Check for provider network memberships
        provider_memberships = ProviderNetworkMembership.objects.filter(
            scheme=scheme,
            status=ProviderNetworkMembership.Status.ACTIVE
        )
        
        # Count benefits
        benefits_count = SchemeBenefit.objects.filter(scheme=scheme).count()
        
        # Count subscription tiers
        tiers_count = SubscriptionTier.objects.filter(scheme=scheme).count()
        
        # Determine if deletion is safe
        has_active_members = active_members.exists()
        has_active_subscriptions = active_subscriptions.exists()
        has_recent_activity = recent_claims.exists() or pending_claims.exists()
        
        # Validation logic depends on deletion mode
        if mode == self.DeletionMode.DEACTIVATE:
            # For deactivation, we can be more lenient - just prevent if there are pending operations
            deletion_blocked = pending_claims.exists()
            
            # Prepare impact assessment for deactivation
            impact_data = {
                'mode': 'deactivate',
                'can_delete': not deletion_blocked,
                'blocking_factors': [],
                'warnings': [],
                'affected_counts': {
                    'total_members': Patient.objects.filter(scheme=scheme).count(),
                    'active_members': active_members.count(),
                    'active_subscriptions': active_subscriptions.count(),
                    'total_subscriptions': MemberSubscription.objects.filter(tier__scheme=scheme).count(),
                    'total_claims': Claim.objects.filter(patient__scheme=scheme).count(),
                    'recent_claims': recent_claims.count(),
                    'pending_claims': pending_claims.count(),
                    'provider_memberships': provider_memberships.count(),
                    'benefits': benefits_count,
                    'subscription_tiers': tiers_count,
                },
                'preservation_notice': 'All member data, claims history, and financial records will be preserved. The scheme will simply be marked as inactive.',
            }
            
            # Only block deactivation for pending claims
            if pending_claims.exists():
                impact_data['blocking_factors'].append({
                    'type': 'pending_claims',
                    'message': f'{pending_claims.count()} pending claims must be processed before deactivation',
                    'severity': 'critical',
                    'action': 'Process or transfer all pending claims before deactivation'
                })
            
            # Add informational warnings for deactivation
            if active_members.exists():
                impact_data['warnings'].append({
                    'type': 'active_members',
                    'message': f'{active_members.count()} active members will no longer be able to make new claims',
                    'severity': 'medium',
                    'action': 'Consider notifying members and providing alternative schemes'
                })
                
        elif mode == self.DeletionMode.CASCADE:
            # For cascade deletion, be very strict
            has_any_members = Patient.objects.filter(scheme=scheme).exists()
            has_any_subscriptions = MemberSubscription.objects.filter(tier__scheme=scheme).exists()
            has_any_claims = Claim.objects.filter(patient__scheme=scheme).exists()
            
            deletion_blocked = has_any_members or has_any_subscriptions or has_any_claims
            
            # Prepare impact assessment for cascade deletion
            impact_data = {
                'mode': 'cascade',
                'can_delete': not deletion_blocked,
                'blocking_factors': [],
                'warnings': [],
                'data_loss_warning': 'CRITICAL: This action will PERMANENTLY DELETE all related data',
                'affected_counts': {
                    'total_members': Patient.objects.filter(scheme=scheme).count(),
                    'active_members': active_members.count(),
                    'active_subscriptions': active_subscriptions.count(),
                    'total_subscriptions': MemberSubscription.objects.filter(tier__scheme=scheme).count(),
                    'total_claims': Claim.objects.filter(patient__scheme=scheme).count(),
                    'recent_claims': recent_claims.count(),
                    'pending_claims': pending_claims.count(),
                    'provider_memberships': provider_memberships.count(),
                    'benefits': benefits_count,
                    'subscription_tiers': tiers_count,
                },
                'will_be_deleted': [],
            }
            
            # Add what will be deleted
            if has_any_members:
                impact_data['will_be_deleted'].append(f'{Patient.objects.filter(scheme=scheme).count()} patient records')
            if has_any_claims:
                impact_data['will_be_deleted'].append(f'{Claim.objects.filter(patient__scheme=scheme).count()} claim records')
            if has_any_subscriptions:
                impact_data['will_be_deleted'].append(f'{MemberSubscription.objects.filter(tier__scheme=scheme).count()} subscription records')
            
            # For cascade, we allow deletion only if no data exists (for now - can be relaxed later)
            if deletion_blocked:
                impact_data['blocking_factors'].append({
                    'type': 'data_exists',
                    'message': 'Cascade deletion is currently only allowed for schemes with no associated data',
                    'severity': 'critical',
                    'action': 'Use deactivation instead, or manually clean up data first'
                })
        
        else:
            raise ValueError(f"Invalid deletion mode: {mode}")
            
        return impact_data
        
        if recent_claims.exists():
            impact_data['warnings'].append({
                'type': 'recent_activity',
                'message': f'{recent_claims.count()} claims were submitted in the last 30 days',
                'severity': 'medium'
            })
        
        if provider_memberships.exists():
            impact_data['warnings'].append({
                'type': 'provider_networks',
                'message': f'{provider_memberships.count()} providers will lose network access',
                'severity': 'low'
            })
        
        return impact_data
    
    def perform_scheme_deactivation(self, scheme: SchemeCategory, confirmation_text: str, reason: str = "") -> Dict:
        """
        Safely deactivate a scheme (soft delete) - preserves all data
        
        Args:
            scheme: The scheme to deactivate
            confirmation_text: User's confirmation text
            reason: Reason for deactivation
            
        Returns:
            Dict with deactivation results
        """
        self.deletion_start_time = timezone.now()
        
        # Validate confirmation text
        expected_text = f"deactivate {scheme.name}"
        if confirmation_text.strip() != expected_text:
            error_msg = f"Confirmation text '{confirmation_text}' does not match expected '{expected_text}'"
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_ATTEMPTED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Invalid confirmation text for deactivation"
            )
            
            raise ValidationError(error_msg)
        
        # Check if deactivation is allowed
        impact_data = self.validate_deletion_eligibility(scheme, self.DeletionMode.DEACTIVATE)
        if not impact_data['can_delete']:
            error_msg = "Scheme deactivation blocked due to pending operations"
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_BLOCKED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Pending claims exist",
                affected_members_count=impact_data['affected_counts']['active_members']
            )
            
            raise ValidationError(error_msg)
        
        try:
            with transaction.atomic():
                # Log deactivation start
                audit_log = SchemeAuditLog.log_scheme_action(
                    user=self.user,
                    action=SchemeAuditLog.ActionType.UPDATED,
                    scheme=scheme,
                    request=self.request,
                    status=SchemeAuditLog.Status.SUCCESS,
                    affected_members_count=impact_data['affected_counts']['total_members'],
                    affected_benefits_count=impact_data['affected_counts']['benefits'],
                    affected_subscriptions_count=impact_data['affected_counts']['active_subscriptions'],
                    reason=f"Scheme deactivation by {self.user.username}: {reason}"
                )
                
                # Perform the deactivation
                scheme.deactivate(user=self.user, reason=reason)
                
                # Calculate duration
                duration = (timezone.now() - self.deletion_start_time).total_seconds()
                audit_log.duration_seconds = Decimal(str(duration))
                audit_log.save()
                
                logger.info(f"Successfully deactivated scheme {scheme.id}: {scheme.name} in {duration:.3f} seconds")
                
                return {
                    'success': True,
                    'action': 'deactivated',
                    'message': f'Scheme "{scheme.name}" has been successfully deactivated',
                    'audit_log_id': audit_log.id,
                    'duration_seconds': duration,
                    'data_preserved': True,
                    'impact_summary': impact_data['affected_counts']
                }
                
        except Exception as e:
            error_msg = f"Failed to deactivate scheme: {str(e)}"
            logger.error(f"Scheme deactivation failed for {scheme.id}: {error_msg}", exc_info=True)
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.UPDATED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason=f"Deactivation failed: {str(e)}"
            )
            
            raise ValidationError(error_msg)

    def perform_cascade_deletion(self, scheme: SchemeCategory, confirmation_text: str) -> Dict:
        """
        Perform cascade deletion (hard delete) - removes all related data
        
        Args:
            scheme: The scheme to delete
            confirmation_text: User's confirmation text (must include "CASCADE DELETE")
            
        Returns:
            Dict with deletion results
        """
        self.deletion_start_time = timezone.now()
        
        # Validate confirmation text - require explicit CASCADE DELETE confirmation
        expected_text = f"CASCADE DELETE {scheme.name}"
        if confirmation_text.strip() != expected_text:
            error_msg = f"Confirmation text '{confirmation_text}' does not match expected '{expected_text}'"
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_ATTEMPTED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Invalid confirmation text for cascade deletion"
            )
            
            raise ValidationError(error_msg)
        
        # Check if cascade deletion is allowed
        impact_data = self.validate_deletion_eligibility(scheme, self.DeletionMode.CASCADE)
        if not impact_data['can_delete']:
            error_msg = "Cascade deletion blocked - scheme has associated data"
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_BLOCKED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Cascade deletion blocked due to existing data"
            )
            
            raise ValidationError(error_msg)
        
        # Create comprehensive snapshot before deletion
        scheme_snapshot = self._create_scheme_snapshot(scheme)
        
        try:
            with transaction.atomic():
                # Log deletion start
                audit_log = SchemeAuditLog.log_scheme_action(
                    user=self.user,
                    action=SchemeAuditLog.ActionType.DELETED,
                    scheme=scheme_snapshot,
                    request=self.request,
                    status=SchemeAuditLog.Status.SUCCESS,
                    affected_members_count=impact_data['affected_counts']['total_members'],
                    affected_benefits_count=impact_data['affected_counts']['benefits'],
                    affected_subscriptions_count=impact_data['affected_counts']['active_subscriptions'],
                    reason=f"CASCADE DELETION by {self.user.username}"
                )
                
                # For now, we'll only allow cascade deletion of empty schemes
                # Future enhancement: implement actual cascade deletion logic here
                
                scheme_id = scheme.id
                scheme_name = scheme.name
                scheme.delete()
                
                # Calculate duration
                duration = (timezone.now() - self.deletion_start_time).total_seconds()
                audit_log.duration_seconds = Decimal(str(duration))
                audit_log.save()
                
                logger.info(f"Successfully cascade deleted scheme {scheme_id}: {scheme_name} in {duration:.3f} seconds")
                
                return {
                    'success': True,
                    'action': 'cascade_deleted',
                    'message': f'Scheme "{scheme_name}" and all related data has been permanently deleted',
                    'audit_log_id': audit_log.id,
                    'duration_seconds': duration,
                    'data_preserved': False,
                    'impact_summary': impact_data['affected_counts']
                }
                
        except Exception as e:
            error_msg = f"Failed to cascade delete scheme: {str(e)}"
            logger.error(f"Scheme cascade deletion failed for {scheme.id}: {error_msg}", exc_info=True)
            
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason=f"Cascade deletion failed: {str(e)}"
            )
            
            raise ValidationError(error_msg)

    def perform_safe_deletion(self, scheme: SchemeCategory, confirmation_text: str) -> Dict:
        """
        Perform the actual scheme deletion with full safety checks and logging.
        
        Args:
            scheme: The scheme to delete
            confirmation_text: User's confirmation text (should match scheme name)
            
        Returns:
            Dict with deletion results
        """
        self.deletion_start_time = timezone.now()
        
        # Validate confirmation text
        expected_text = f"delete {scheme.name}"
        if confirmation_text.strip() != expected_text:
            error_msg = f"Confirmation text '{confirmation_text}' does not match expected '{expected_text}'"
            
            # Log failed attempt
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_ATTEMPTED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Invalid confirmation text"
            )
            
            raise ValidationError(error_msg)
        
        # Final validation check
        impact_data = self.validate_deletion_eligibility(scheme)
        if not impact_data['can_delete']:
            error_msg = "Scheme deletion blocked due to active dependencies"
            
            # Log blocked attempt
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETION_BLOCKED,
                scheme=scheme,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                reason="Active dependencies exist",
                affected_members_count=impact_data['affected_counts']['active_members'],
                affected_subscriptions_count=impact_data['affected_counts']['active_subscriptions']
            )
            
            raise ValidationError(error_msg)
        
        # Prepare comprehensive scheme data snapshot
        scheme_snapshot = self._create_scheme_snapshot(scheme)
        
        try:
            with transaction.atomic():
                # Log deletion start
                audit_log = SchemeAuditLog.log_scheme_action(
                    user=self.user,
                    action=SchemeAuditLog.ActionType.DELETED,
                    scheme=scheme_snapshot,
                    request=self.request,
                    status=SchemeAuditLog.Status.SUCCESS,
                    affected_members_count=impact_data['affected_counts']['total_members'],
                    affected_benefits_count=impact_data['affected_counts']['benefits'],
                    affected_subscriptions_count=impact_data['affected_counts']['active_subscriptions'],
                    reason=f"Admin deletion by {self.user.username}"
                )
                
                # Perform the deletion
                # Note: Related objects will be handled by database constraints:
                # - SchemeBenefit: CASCADE (will be deleted)
                # - Patient: PROTECT (already validated no active members)
                # - SubscriptionTier: Related to scheme (will be deleted)
                # - ProviderNetworkMembership: CASCADE (will be deleted)
                
                scheme_id = scheme.id
                scheme_name = scheme.name
                scheme.delete()
                
                # Calculate deletion duration
                duration = (timezone.now() - self.deletion_start_time).total_seconds()
                
                # Update audit log with completion details
                audit_log.duration_seconds = Decimal(str(duration))
                audit_log.save()
                
                logger.info(f"Successfully deleted scheme {scheme_id}: {scheme_name} in {duration:.3f} seconds")
                
                return {
                    'success': True,
                    'message': f'Scheme "{scheme_name}" has been successfully deleted',
                    'deletion_id': audit_log.id,
                    'duration_seconds': duration,
                    'impact_summary': impact_data['affected_counts']
                }
                
        except Exception as e:
            error_msg = f"Failed to delete scheme: {str(e)}"
            logger.error(f"Scheme deletion failed for {scheme.id}: {error_msg}", exc_info=True)
            
            # Log the failure
            SchemeAuditLog.log_scheme_action(
                user=self.user,
                action=SchemeAuditLog.ActionType.DELETED,
                scheme=scheme_snapshot,
                request=self.request,
                status=SchemeAuditLog.Status.FAILED,
                error_details=error_msg,
                affected_members_count=impact_data['affected_counts']['total_members'],
                affected_benefits_count=impact_data['affected_counts']['benefits']
            )
            
            raise ValidationError(error_msg)
    
    def _create_scheme_snapshot(self, scheme: SchemeCategory) -> Dict:
        """Create a comprehensive snapshot of the scheme before deletion"""
        
        # Basic scheme data
        snapshot = {
            'id': scheme.id,
            'name': scheme.name,
            'description': scheme.description,
            'price': float(scheme.price) if scheme.price else 0.0,
            'created_at': getattr(scheme, 'created_at', timezone.now()).isoformat(),
        }
        
        # Benefits data
        benefits = SchemeBenefit.objects.filter(scheme=scheme).select_related('benefit_type')
        snapshot['benefits'] = [
            {
                'id': benefit.id,
                'benefit_type': benefit.benefit_type.name,
                'coverage_amount': float(benefit.coverage_amount) if benefit.coverage_amount else None,
                'coverage_period': benefit.coverage_period,
                'is_active': benefit.is_active
            }
            for benefit in benefits
        ]
        
        # Subscription tiers data
        tiers = SubscriptionTier.objects.filter(scheme=scheme)
        snapshot['subscription_tiers'] = [
            {
                'id': tier.id,
                'name': tier.name,
                'tier_type': tier.tier_type,
                'monthly_price': float(tier.monthly_price) if tier.monthly_price else 0.0,
                'yearly_price': float(tier.yearly_price) if tier.yearly_price else 0.0,
                'is_active': tier.is_active
            }
            for tier in tiers
        ]
        
        # Member statistics (don't include PII in snapshot)
        snapshot['member_statistics'] = {
            'total_patients': Patient.objects.filter(scheme=scheme).count(),
            'active_patients': Patient.objects.filter(
                scheme=scheme, 
                status=Patient.Status.ACTIVE
            ).count(),
            'total_claims': Claim.objects.filter(patient__scheme=scheme).count(),
            'total_approved_claims': Claim.objects.filter(
                patient__scheme=scheme, 
                status=Claim.Status.APPROVED
            ).count(),
        }
        
        return snapshot