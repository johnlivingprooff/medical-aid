# Phase 5: Advanced Scheme Pricing & Subscription Management

## Overview
Transform the current benefit-sum pricing model into a sophisticated subscription-based system with tiered pricing, flexible benefit access, and comprehensive member management.

## Business Value
- **Clear Pricing Model**: Members understand exactly what they're paying for
- **Flexible Options**: Monthly/yearly subscriptions with different benefit tiers
- **Better Risk Management**: Predictable revenue streams and utilization control
- **Competitive Advantage**: Modern subscription model vs traditional benefit pooling

## Current State Analysis

### Problems with Current System
1. **Pricing Confusion**: Scheme price = sum of all benefit values (not intuitive)
2. **Temporal Mismatch**: Benefits have different periods but pricing doesn't reflect this
3. **No Subscription Model**: All members pay the same regardless of usage patterns
4. **Limited Flexibility**: Can't offer different benefit packages

### Current Pricing Logic
```python
# Current: Simple sum of benefit values
scheme_price = sum(benefit.coverage_amount * benefit.coverage_limit_count for benefit in scheme.benefits)
```

## Target Architecture

### New Models Required

#### 1. SubscriptionTier Model
```python
class SubscriptionTier(models.Model):
    name = models.CharField(max_length=50)  # "Basic", "Standard", "Premium"
    scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2)
    yearly_price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    max_dependents = models.PositiveIntegerField(default=0)
    benefit_categories = models.ManyToManyField(BenefitCategory)
```

#### 2. MemberSubscription Model
```python
class MemberSubscription(models.Model):
    member = models.OneToOneField(Patient, on_delete=models.CASCADE)
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT)
    subscription_type = models.CharField(choices=[('MONTHLY', 'Monthly'), ('YEARLY', 'Yearly')])
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    auto_renew = models.BooleanField(default=True)
    payment_method = models.ForeignKey(PaymentMethod, null=True, on_delete=models.SET_NULL)
```

#### 3. BenefitCategory Model
```python
class BenefitCategory(models.Model):
    name = models.CharField(max_length=50)  # "Core", "Premium", "Add-on"
    description = models.TextField()
    subscription_required = models.BooleanField(default=True)
    access_rules = models.JSONField(default=dict)
```

## Implementation Roadmap

### Week 13: Foundation Setup
**Goal**: Create core subscription infrastructure

#### Tasks:
1. **Database Schema Updates**
   - Create SubscriptionTier, MemberSubscription, BenefitCategory models
   - Add migration scripts
   - Update existing scheme relationships

2. **Initial Data Setup**
   - Create default subscription tiers for existing schemes
   - Classify existing benefits into categories
   - Set up initial pricing structure

3. **Basic API Endpoints**
   - SubscriptionTier CRUD operations
   - MemberSubscription management
   - Benefit category management

#### Success Criteria:
- ✅ All new models created and migrated
- ✅ Default tiers created for existing schemes
- ✅ Basic API endpoints functional

### Week 14: Core Subscription Logic
**Goal**: Implement subscription management and benefit access control

#### Tasks:
1. **Subscription Management**
   - Member subscription creation/upgrade/downgrade
   - Subscription period calculations
   - Auto-renewal logic

2. **Benefit Access Control**
   - Implement benefit availability checks
   - Add subscription-based filtering
   - Create benefit utilization tracking

3. **Pricing Engine Updates**
   - Replace current pricing logic with tiered system
   - Add subscription period calculations
   - Implement prorated pricing

#### Success Criteria:
- ✅ Members can subscribe to different tiers
- ✅ Benefit access respects subscription limits
- ✅ Pricing reflects subscription choices

### Week 15: Billing & Payment Integration
**Goal**: Implement billing cycles and payment processing

#### Tasks:
1. **Billing Cycle Management**
   - Monthly/yearly billing generation
   - Invoice creation and tracking
   - Payment due date management

2. **Payment Processing**
   - Payment method storage (secure)
   - Automated payment collection
   - Failed payment handling

3. **Proration Logic**
   - Mid-cycle subscription changes
   - Refund calculations for downgrades
   - Credit handling for upgrades

#### Success Criteria:
- ✅ Automated billing cycles working
- ✅ Payment processing integrated
- ✅ Proration calculations accurate

### Week 16: Member Portal & Analytics
**Goal**: Complete user experience and monitoring

#### Tasks:
1. **Member Portal Enhancements**
   - Subscription management interface
   - Benefit utilization dashboard
   - Billing history and invoices

2. **Admin Analytics**
   - Subscription metrics and trends
   - Benefit utilization reports
   - Revenue analytics by tier

3. **System Integration**
   - Update claim validation for subscriptions
   - Modify benefit processing logic
   - Add subscription checks to all relevant workflows

#### Success Criteria:
- ✅ Members can manage subscriptions via portal
- ✅ Admins have comprehensive analytics
- ✅ All system workflows respect subscription limits

## Technical Implementation Details

### Key Components to Modify

#### 1. Claims Validation (`claims/services.py`)
```python
def validate_and_process_claim_enhanced(claim: Claim) -> Tuple[bool, float, str, dict]:
    """Enhanced validation with subscription-aware benefit checking"""
    patient = claim.patient
    subscription = patient.subscription  # New field

    # Check if benefit is included in member's subscription tier
    if not subscription.tier.benefits.filter(id=claim.service_type.id).exists():
        return False, 0.0, "Benefit not included in subscription tier", {}

    # Continue with existing validation logic...
```

#### 2. Scheme Views (`schemes/views.py`)
```python
def _recalc_scheme_price(self, scheme_id: int):
    """Updated to work with subscription tiers instead of simple sum"""
    # This method becomes obsolete - pricing now handled by tiers
    pass
```

#### 3. Patient Model Updates (`claims/models.py`)
```python
class Patient(models.Model):
    # ... existing fields ...
    subscription = models.OneToOneField(
        'MemberSubscription',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='patient'
    )
```

### Database Migration Strategy

#### Phase 1: Add New Tables
```sql
-- Create subscription-related tables
CREATE TABLE subscription_tier (...);
CREATE TABLE member_subscription (...);
CREATE TABLE benefit_category (...);
```

#### Phase 2: Data Migration
```python
# Migrate existing scheme prices to subscription tiers
for scheme in SchemeCategory.objects.all():
    # Create default tier with current price as yearly
    SubscriptionTier.objects.create(
        name="Standard",
        scheme=scheme,
        monthly_price=scheme.price / 12,
        yearly_price=scheme.price,
        description=f"Standard coverage for {scheme.name}"
    )
```

#### Phase 3: Update References
```python
# Update patient records to reference subscriptions
for patient in Patient.objects.all():
    # Assign default subscription based on scheme
    default_tier = patient.scheme.subscription_tiers.first()
    if default_tier:
        MemberSubscription.objects.create(
            member=patient,
            tier=default_tier,
            subscription_type='MONTHLY',  # Default to monthly
            start_date=patient.enrollment_date,
            end_date=patient.enrollment_date + timedelta(days=365)
        )
```

## Risk Assessment & Mitigation

### Technical Risks
1. **Data Migration Complexity**
   - **Mitigation**: Comprehensive testing, rollback scripts, gradual rollout

2. **System Performance**
   - **Mitigation**: Database indexing, query optimization, caching strategy

3. **Integration Complexity**
   - **Mitigation**: Modular implementation, feature flags, gradual integration

### Business Risks
1. **Member Confusion**
   - **Mitigation**: Clear communication, educational materials, support resources

2. **Revenue Impact**
   - **Mitigation**: Grandfather existing pricing, gradual tier introduction, usage analytics

3. **Regulatory Compliance**
   - **Mitigation**: Legal review of subscription terms, transparent pricing disclosure

## Success Metrics

### Business Metrics
- **Adoption Rate**: >80% of members actively using subscription features within 3 months
- **Tier Distribution**: Balanced distribution across Basic/Standard/Premium tiers
- **Revenue Growth**: 15% increase in average revenue per member
- **Member Satisfaction**: >4.5/5 rating for subscription experience

### Technical Metrics
- **System Performance**: <10% increase in response times
- **Data Accuracy**: >99.9% accuracy in billing and benefit calculations
- **System Uptime**: >99.95% availability during implementation

## Dependencies & Prerequisites

### Required Before Starting
- ✅ Phase 1-4 completion (core system functionality)
- ✅ User authentication and authorization system
- ✅ Basic scheme and benefit management
- ✅ Payment processing infrastructure (if available)

### Parallel Development
- **Payment Integration**: Can be developed in parallel with billing system
- **Analytics Dashboard**: Can be built alongside core subscription features
- **Mobile App Updates**: Can be updated in parallel with web portal

## Testing Strategy

### Unit Testing
- Subscription tier logic
- Benefit access validation
- Pricing calculations
- Billing cycle management

### Integration Testing
- End-to-end subscription flow
- Payment processing integration
- Claim validation with subscriptions
- Member portal functionality

### User Acceptance Testing
- Member subscription management
- Admin tier configuration
- Billing and payment flows
- Benefit utilization tracking

## Rollback Plan

### Phase Rollback
If issues arise, can rollback by:
1. **Feature Flags**: Disable subscription features while keeping data
2. **Data Preservation**: Keep subscription data for future reactivation
3. **Gradual Rollback**: Roll back features incrementally

### Complete Rollback
If full rollback needed:
1. **Data Export**: Export subscription data for analysis
2. **Schema Revert**: Remove subscription-related tables
3. **Code Revert**: Revert to original pricing logic
4. **Data Restore**: Restore original scheme pricing

## Conclusion

This phase transforms the medical aid system from a simple benefit aggregator to a sophisticated subscription-based platform. The tiered pricing model provides clarity, flexibility, and better financial management while maintaining the comprehensive benefit coverage that members expect.

**Estimated Timeline**: 4 weeks
**Risk Level**: Medium (well-planned migration strategy)
**Business Impact**: High (fundamental pricing model change)
**Technical Complexity**: High (multiple system integrations required)</content>
<parameter name="filePath">j:\Documents\CODE\Projects\medical-aid\PHASE_5_SUBSCRIPTION_MODEL.md