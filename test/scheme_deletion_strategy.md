# Enhanced Scheme Deletion Strategy

## Option 1: Add Cascade Deletion Mode (High Risk)
def perform_cascade_deletion(self, scheme: SchemeCategory, confirmation_text: str, cascade_mode: str = 'restrict') -> Dict:
    """
    Enhanced deletion with cascade options
    
    cascade_mode options:
    - 'restrict': Current behavior (PROTECT relationships)
    - 'cascade': Hard delete everything (DANGEROUS)
    - 'soft_delete': Mark scheme as deleted but preserve data
    - 'migrate': Move members to another scheme before deletion
    """
    
    if cascade_mode == 'cascade':
        # WARNING: This will delete ALL related data
        # - All patient records
        # - All claims history
        # - All subscription data
        # - All financial records
        
        impact_warning = {
            'data_loss_warning': 'CRITICAL: This action will PERMANENTLY DELETE:',
            'will_be_deleted': [
                f'{Patient.objects.filter(scheme=scheme).count()} patient records',
                f'{Claim.objects.filter(patient__scheme=scheme).count()} claim records',
                f'{MemberSubscription.objects.filter(tier__scheme=scheme).count()} subscription records',
                'ALL financial and audit history for this scheme'
            ],
            'legal_notice': 'Ensure compliance with data retention regulations before proceeding'
        }
    
    elif cascade_mode == 'soft_delete':
        # Mark as deleted but preserve all data
        # Add is_deleted field to SchemeCategory model
        scheme.is_deleted = True
        scheme.deletion_date = timezone.now()
        scheme.save()
    
    elif cascade_mode == 'migrate':
        # Require target scheme for member migration
        # Move all members to new scheme before deletion
        pass

## Option 2: Enhanced Warning System (Recommended)
def get_comprehensive_deletion_impact(self, scheme: SchemeCategory) -> Dict:
    """
    Provide detailed impact assessment with business context
    """
    
    impact_data = {
        'business_impact': {
            'financial_records': f'{Invoice.objects.filter(subscription__tier__scheme=scheme).count()} invoices will be affected',
            'claim_history': f'{Claim.objects.filter(patient__scheme=scheme).count()} historical claims',
            'member_years': 'X years of member enrollment data',
            'compliance_risk': 'Medical aid regulations may require data retention'
        },
        'deletion_alternatives': [
            'Mark scheme as inactive instead of deleting',
            'Migrate members to alternative scheme',
            'Archive scheme data to separate storage',
            'Export data before deletion for compliance'
        ]
    }