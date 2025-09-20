from django.contrib import admin
from .models import SchemeCategory, SchemeBenefit, SubscriptionTier


@admin.register(SchemeCategory)
class SchemeCategoryAdmin(admin.ModelAdmin):
	list_display = ("name",)
	search_fields = ("name",)


@admin.register(SchemeBenefit)
class SchemeBenefitAdmin(admin.ModelAdmin):
	list_display = ("scheme", "benefit_type", "coverage_amount", "coverage_period")
	list_filter = ("benefit_type", "coverage_period")
	search_fields = ("scheme__name",)


@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
	list_display = ('name', 'scheme', 'tier_type', 'monthly_price', 'yearly_price', 'max_dependents', 'is_active')
	list_filter = ('scheme', 'tier_type', 'is_active')
	search_fields = ('name', 'scheme__name', 'description')
	ordering = ('scheme', 'sort_order')

	fieldsets = (
		('Basic Information', {
			'fields': ('name', 'scheme', 'tier_type', 'description')
		}),
		('Pricing', {
			'fields': ('monthly_price', 'yearly_price')
		}),
		('Limits', {
			'fields': ('max_dependents', 'max_claims_per_month', 'max_coverage_per_year')
		}),
		('Settings', {
			'fields': ('benefit_categories', 'is_active', 'sort_order')
		}),
	)

