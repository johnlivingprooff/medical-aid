from django.db.models import Q, F
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from accounts.models import ProviderProfile
from schemes.models import SchemeCategory, BenefitType, SchemeBenefit
from claims.models import Patient, Claim
from core.permissions import IsAdminOrProvider

User = get_user_model()


class GlobalSearchView(APIView):
    """
    Global search endpoint that searches across multiple entities:
    - Schemes
    - Claims
    - Members/Patients
    - Providers
    - Service Types
    - Benefit Types
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        entity_type = request.query_params.get('type', 'all')  # all, schemes, claims, members, providers, services
        limit = int(request.query_params.get('limit', 10))

        if not query or len(query) < 2:
            return Response({
                'results': [],
                'total': 0,
                'query': query
            })

        results = []
        total_count = 0

        # Search Schemes
        if entity_type in ['all', 'schemes']:
            scheme_results = self._search_schemes(query, limit)
            results.extend(scheme_results)
            total_count += len(scheme_results)

        # Search Claims
        if entity_type in ['all', 'claims']:
            claim_results = self._search_claims(query, limit, request.user)
            results.extend(claim_results)
            total_count += len(claim_results)

        # Search Members/Patients
        if entity_type in ['all', 'members']:
            member_results = self._search_members(query, limit, request.user)
            results.extend(member_results)
            total_count += len(member_results)

        # Search Providers
        if entity_type in ['all', 'providers']:
            provider_results = self._search_providers(query, limit)
            results.extend(provider_results)
            total_count += len(provider_results)

        # Search Service Types
        if entity_type in ['all', 'services']:
            service_results = self._search_service_types(query, limit)
            results.extend(service_results)
            total_count += len(service_results)

        # Search Benefit Types
        if entity_type in ['all', 'benefits']:
            benefit_results = self._search_benefit_types(query, limit)
            results.extend(benefit_results)
            total_count += len(benefit_results)

        # Sort results by relevance (you could implement a scoring system here)
        # For now, just return them in the order they were found

        return Response({
            'results': results[:limit],  # Respect the overall limit
            'total': total_count,
            'query': query,
            'entity_type': entity_type
        })

    def _search_schemes(self, query, limit):
        """Search scheme categories"""
        schemes = SchemeCategory.objects.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query)
        )[:limit]

        return [{
            'id': scheme.id,
            'type': 'scheme',
            'title': scheme.name,
            'subtitle': scheme.description[:100] + '...' if len(scheme.description) > 100 else scheme.description,
            'url': f'/schemes/{scheme.id}',
            'metadata': {
                'price': str(scheme.price),
                'benefit_count': scheme.benefits.count()
            }
        } for scheme in schemes]

    def _search_claims(self, query, limit, user):
        """Search claims with role-based access"""
        base_query = Claim.objects.select_related('patient', 'patient__scheme', 'provider')

        # Filter based on user role
        if user.role == 'PATIENT':
            # Patients can only see their own claims
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                base_query = base_query.filter(patient=patient_profile)
            else:
                return []
        elif user.role == 'PROVIDER':
            # Providers can only see claims for their facility
            provider_profile = getattr(user, 'provider_profile', None)
            if provider_profile:
                base_query = base_query.filter(provider=provider_profile)
            else:
                return []

        # Apply search filters
        claims = base_query.filter(
            Q(id__icontains=query) |
            Q(patient__user__first_name__icontains=query) |
            Q(patient__user__last_name__icontains=query) |
            Q(patient__member_id__icontains=query) |
            Q(diagnosis_code__icontains=query) |
            Q(procedure_code__icontains=query) |
            Q(notes__icontains=query)
        )[:limit]

        return [{
            'id': claim.id,
            'type': 'claim',
            'title': f'Claim #{claim.id}',
            'subtitle': f'{claim.patient.user.get_full_name()} - {claim.patient.scheme.name}',
            'url': f'/claims/{claim.id}',
            'metadata': {
                'status': claim.status,
                'amount': str(claim.cost),
                'date': claim.date_of_service.strftime('%Y-%m-%d') if claim.date_of_service else claim.date_submitted.strftime('%Y-%m-%d'),
                'diagnosis_code': claim.diagnosis_code[:50] if claim.diagnosis_code else 'N/A'
            }
        } for claim in claims]

    def _search_members(self, query, limit, user):
        """Search patients/members with role-based access"""
        base_query = Patient.objects.select_related('user', 'scheme')

        # Filter based on user role
        if user.role == 'PATIENT':
            # Patients can only see themselves and their dependents
            patient_profile = getattr(user, 'patient_profile', None)
            if patient_profile:
                base_query = base_query.filter(
                    Q(id=patient_profile.id) |
                    Q(principal_member=patient_profile)
                )
            else:
                return []

        # Apply search filters
        members = base_query.filter(
            Q(user__first_name__icontains=query) |
            Q(user__last_name__icontains=query) |
            Q(user__username__icontains=query) |
            Q(member_id__icontains=query) |
            Q(scheme__name__icontains=query) |
            Q(phone__icontains=query)
        )[:limit]

        return [{
            'id': member.id,
            'type': 'member',
            'title': member.user.get_full_name(),
            'subtitle': f'Member ID: {member.member_id} - {member.scheme.name}',
            'url': f'/members/{member.id}',
            'metadata': {
                'status': member.status,
                'scheme': member.scheme.name,
                'enrollment_date': member.enrollment_date.strftime('%Y-%m-%d') if member.enrollment_date else None,
                'phone': member.phone
            }
        } for member in members]

    def _search_providers(self, query, limit):
        """Search service providers"""
        providers = ProviderProfile.objects.select_related('user').filter(
            Q(user__first_name__icontains=query) |
            Q(user__last_name__icontains=query) |
            Q(facility_name__icontains=query) |
            Q(city__icontains=query) |
            Q(phone__icontains=query)
        )[:limit]

        return [{
            'id': provider.id,
            'type': 'provider',
            'title': provider.facility_name,
            'subtitle': f'{provider.get_facility_type_display()} - {provider.city}',
            'url': f'/providers/{provider.id}',
            'metadata': {
                'facility_type': provider.facility_type,
                'phone': provider.phone,
                'address': provider.address
            }
        } for provider in providers]

    def _search_service_types(self, query, limit):
        """Search service types (facility types)"""
        # Get unique facility types that match the query
        providers = ProviderProfile.objects.filter(
            Q(facility_type__icontains=query)
        ).values('facility_type').distinct()[:limit]

        results = []
        for provider in providers:
            facility_type = provider['facility_type']
            count = ProviderProfile.objects.filter(facility_type=facility_type).count()

            results.append({
                'id': facility_type,
                'type': 'service_type',
                'title': dict(ProviderProfile.FacilityType.choices).get(facility_type, facility_type),
                'subtitle': f'{count} providers',
                'url': f'/providers?type={facility_type}',
                'metadata': {
                    'facility_type': facility_type,
                    'provider_count': count
                }
            })

        return results

    def _search_benefit_types(self, query, limit):
        """Search benefit types"""
        benefit_types = BenefitType.objects.filter(
            Q(name__icontains=query)
        ).prefetch_related('scheme_benefits')[:limit]

        return [{
            'id': benefit_type.id,
            'type': 'benefit_type',
            'title': benefit_type.name,
            'subtitle': f'Used in {benefit_type.scheme_benefits.count()} scheme benefits',
            'url': f'/schemes/benefits?type={benefit_type.id}',
            'metadata': {
                'scheme_count': benefit_type.scheme_benefits.values('scheme').distinct().count(),
                'benefit_count': benefit_type.scheme_benefits.count()
            }
        } for benefit_type in benefit_types]