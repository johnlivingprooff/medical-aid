# Medical Aid Scheme Pricing & Subscription Model Analysis

## Executive Summary

This document analyzes the current scheme pricing model in the Medical Aid Management System and proposes a comprehensive approach to pricing and subscription management. The analysis addresses fundamental questions about how scheme pricing should work, benefit availability periods, and member subscription models.

## Current System Analysis

### How Pricing Currently Works

The current system calculates scheme prices by **summing benefit values**:

```python
# Current pricing calculation (schemes/views.py)
def _recalc_scheme_price(self, scheme_id: int):
    total = (
        SchemeBenefit.objects.filter(scheme_id=scheme_id)
        .annotate(final=F('coverage_amount') * Coalesce(F('coverage_limit_count'), Value(1)))
        .aggregate(total=Sum('final'))['total']
        or 0
    )
    SchemeCategory.objects.filter(id=scheme_id).update(price=total)
```

**Example Current Calculation:**
- Scheme A has benefits:
  - CONSULTATION: $1,000 × 6 visits/year = $6,000
  - SPECIALIST: $1,500 × 4 visits/year = $6,000
  - SURGERY: $50,000 × 2 procedures/year = $100,000
  - PHARMACY: $500 × unlimited/monthly = $500
- **Total Scheme Price: $112,500**

### Current Issues Identified

1. **Pricing Confusion**: Scheme price is a sum of benefit values, not a subscription fee
2. **Temporal Mismatch**: Benefits have different periods (monthly/yearly) but pricing doesn't account for this
3. **Subscription Model Missing**: No clear monthly vs yearly subscription pricing
4. **Benefit Availability**: Unclear how benefits are prorated or accessed over time

## Core Questions & Analysis

### Question 1: Should Scheme Price Reflect Monthly or Yearly Subscription?

**Current Reality**: The system sums all benefit values regardless of their temporal nature.

**Proposed Solution**: Implement a **tiered subscription model** with clear pricing periods.

### Question 2: How Should Benefits with Different Periods Be Handled?

**Current Issue**: Benefits like PHARMACY (monthly) and SURGERY (yearly) are treated equally in pricing.

**Analysis of Options**:

#### Option A: Full Access Model
- Member pays full scheme price (e.g., $112,500/year)
- Gets access to ALL benefits for the entire period
- **Pros**: Simple, predictable pricing
- **Cons**: High upfront cost, may not suit all members

#### Option B: Prorated Access Model
- Member pays monthly subscription (e.g., $9,375/month)
- Benefits are prorated based on payment period
- **Pros**: Lower barrier to entry, flexible
- **Cons**: Complex benefit tracking, potential confusion

#### Option C: Hybrid Model (Recommended)
- Base monthly subscription covers core benefits
- Premium add-ons for high-cost benefits
- Clear benefit tiers and availability periods

## Recommended Pricing Architecture

### 1. Subscription Tiers

```python
class SubscriptionTier(models.Model):
    name = models.CharField(max_length=50)  # "Basic", "Standard", "Premium"
    scheme = models.ForeignKey(SchemeCategory, on_delete=models.CASCADE)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2)
    yearly_price = models.DecimalField(max_digits=10, decimal_places=2)  # With discount
    description = models.TextField()
    max_dependents = models.PositiveIntegerField(default=0)
```

### 2. Benefit Categories & Access Rules

```python
class BenefitCategory(models.Model):
    name = models.CharField(max_length=50)  # "Core", "Premium", "Add-on"
    description = models.TextField()
    subscription_required = models.BooleanField(default=True)
    access_rules = models.JSONField()  # Complex access logic
```

### 3. Member Subscription Model

```python
class MemberSubscription(models.Model):
    member = models.OneToOneField(Patient, on_delete=models.CASCADE)
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT)
    subscription_type = models.CharField(choices=[
        ('MONTHLY', 'Monthly'),
        ('YEARLY', 'Yearly')
    ])
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    auto_renew = models.BooleanField(default=True)
```

## Practical Implementation Strategy

### Phase 1: Foundation (Weeks 13-14)
**Goal**: Establish core subscription infrastructure

#### Tasks:
1. **Create Subscription Models**
   - `SubscriptionTier` with pricing
   - `MemberSubscription` tracking
   - `BenefitCategory` classification

2. **Migrate Existing Data**
   - Convert current scheme prices to subscription tiers
   - Classify existing benefits into categories
   - Create default subscription tiers

3. **Update Pricing Logic**
   - Replace simple sum with tiered pricing
   - Add subscription period calculations
   - Implement benefit access validation

### Phase 2: Advanced Features (Weeks 15-16)
**Goal**: Enhanced subscription management

#### Tasks:
1. **Benefit Access Control**
   - Implement benefit availability based on subscription
   - Add benefit utilization tracking per subscription period
   - Create benefit reset logic for new periods

2. **Billing Integration**
   - Monthly/yearly billing cycles
   - Prorated billing for mid-cycle changes
   - Payment method management

3. **Member Portal Enhancements**
   - Subscription management interface
   - Benefit utilization dashboard
   - Upgrade/downgrade functionality

### Phase 3: Analytics & Optimization (Weeks 17-18)
**Goal**: Data-driven pricing optimization

#### Tasks:
1. **Usage Analytics**
   - Track benefit utilization patterns
   - Identify under/over-utilized benefits
   - Member engagement metrics

2. **Dynamic Pricing**
   - Risk-based premium adjustments
   - Utilization-based pricing tiers
   - Seasonal pricing variations

## Detailed Pricing Examples

### Example Scheme: "Comprehensive Health Plan"

**Current Pricing**: $112,500 (sum of all benefits)

**Proposed Tiered Pricing**:

#### Basic Tier ($250/month, $2,500/year)
- **Core Benefits**: Primary care, basic pharmacy, preventive care
- **Coverage**: $15,000/year total benefits
- **Target**: Individual members, young families

#### Standard Tier ($450/month, $4,500/year)
- **Includes Basic + Extended Benefits**: Specialist care, diagnostic imaging, maternity care
- **Coverage**: $50,000/year total benefits
- **Target**: Families, middle-income members

#### Premium Tier ($750/month, $7,500/year)
- **Includes Standard + Premium Benefits**: Major surgery, emergency care, international coverage
- **Coverage**: $150,000/year total benefits
- **Target**: High-risk individuals, expatriates

### Benefit Access Logic

```python
def check_benefit_access(member: Patient, benefit: SchemeBenefit) -> bool:
    """
    Determine if member can access a specific benefit based on subscription
    """
    subscription = member.subscription
    
    # Check subscription tier includes benefit category
    if benefit.category not in subscription.tier.benefit_categories:
        return False
    
    # Check benefit utilization limits
    current_usage = get_benefit_usage(member, benefit, subscription.current_period)
    if current_usage >= benefit.coverage_limit_count:
        return False
    
    # Check temporal availability
    if benefit.coverage_period == 'MONTHLY':
        # Available throughout subscription period
        return True
    elif benefit.coverage_period == 'YEARLY':
        # Available based on subscription type
        if subscription.subscription_type == 'MONTHLY':
            # Prorate based on months paid
            return check_prorated_access(member, benefit)
        else:
            return True
    
    return True
```

## Migration Strategy

### Data Migration Plan

1. **Analyze Existing Schemes**
   - Calculate current benefit distributions
   - Identify benefit usage patterns
   - Determine appropriate tier assignments

2. **Create Subscription Tiers**
   - Map existing scheme prices to appropriate tiers
   - Set competitive pricing based on market analysis
   - Define benefit inclusions per tier

3. **Member Transition**
   - Grandfather existing members at current pricing
   - Offer upgrade/downgrade options
   - Communicate changes clearly

### Risk Mitigation

1. **Pricing Transparency**
   - Clear benefit inclusions per tier
   - No hidden costs or surprise charges
   - Easy comparison between tiers

2. **Member Communication**
   - Detailed benefit explanations
   - Usage tracking and alerts
   - Support for tier changes

3. **System Reliability**
   - Comprehensive testing of access controls
   - Fallback mechanisms for edge cases
   - Regular audits of benefit utilization

## Success Metrics

### Business Metrics
- **Member Retention**: >95% retention rate
- **Tier Upgrade Rate**: >20% of members upgrade within 6 months
- **Claim Processing**: <2% access denied due to subscription issues

### Technical Metrics
- **System Uptime**: >99.9% availability
- **Response Time**: <500ms for benefit access checks
- **Data Accuracy**: >99.99% accuracy in benefit calculations

## Conclusion & Recommendations

### Recommended Approach: Hybrid Tiered Model

**Why This Approach?**
1. **Clarity**: Members understand exactly what they're paying for
2. **Flexibility**: Different pricing options for different needs
3. **Scalability**: Easy to add new tiers or modify existing ones
4. **Business Sustainability**: Better risk management and pricing control

### Implementation Priority
1. **Phase 1 (Weeks 13-14)**: Core subscription infrastructure
2. **Phase 2 (Weeks 15-16)**: Advanced features and billing
3. **Phase 3 (Weeks 17-18)**: Analytics and optimization

### Key Success Factors
- **Clear Communication**: Transparent pricing and benefit explanations
- **Seamless Migration**: Smooth transition for existing members
- **Robust Technology**: Reliable access control and billing systems
- **Continuous Improvement**: Data-driven pricing optimization

This approach transforms the current benefit-sum pricing into a sophisticated subscription model that better serves both members and the medical aid organization.</content>
<parameter name="filePath">j:\Documents\CODE\Projects\medical-aid\SCHEME_PRICING_ANALYSIS.md