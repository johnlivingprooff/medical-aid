from django.contrib import admin
from .models import SchemeCategory, SchemeBenefit


@admin.register(SchemeCategory)
class SchemeCategoryAdmin(admin.ModelAdmin):
	list_display = ("name",)
	search_fields = ("name",)


@admin.register(SchemeBenefit)
class SchemeBenefitAdmin(admin.ModelAdmin):
	list_display = ("scheme", "benefit_type", "coverage_amount", "coverage_period")
	list_filter = ("benefit_type", "coverage_period")
	search_fields = ("scheme__name",)

