from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.shortcuts import get_object_or_404

from .models import EDITransaction
from .serializers import EDISubmitSerializer, EDIResponseSerializer, EDITransactionSerializer
from .edi_service import edi_processor


class EDISubmitView(APIView):
    """Enhanced EDI submission view with comprehensive X12 processing and validation"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=EDISubmitSerializer,
        responses={
            200: EDIResponseSerializer,
            400: OpenApiResponse(description='Validation error'),
            500: OpenApiResponse(description='Processing error')
        }
    )
    def post(self, request):
        """Submit EDI content for processing"""
        serializer = EDISubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        x12_content = serializer.validated_data['x12_content']
        transaction_type = serializer.validated_data['transaction_type']

        # Get optional related objects
        claim = None
        patient = None
        provider = None

        if 'claim_id' in serializer.validated_data:
            from claims.models import Claim
            try:
                claim = Claim.objects.get(id=serializer.validated_data['claim_id'])
                patient = claim.patient
                provider = claim.provider
            except Claim.DoesNotExist:
                return Response(
                    {'detail': 'Claim not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        if 'patient_id' in serializer.validated_data:
            from claims.models import Patient
            try:
                patient = Patient.objects.get(id=serializer.validated_data['patient_id'])
            except Patient.DoesNotExist:
                return Response(
                    {'detail': 'Patient not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Process the EDI submission
        success, message, response_data = edi_processor.process_edi_submission(
            x12_content=x12_content,
            transaction_type=transaction_type,
            provider=provider,
            claim=claim,
            patient=patient
        )

        if success:
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            return Response(
                {'detail': message, **response_data},
                status=status.HTTP_400_BAD_REQUEST
            )


class EDITransactionDetailView(APIView):
    """View for retrieving EDI transaction details"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: EDITransactionSerializer,
            404: OpenApiResponse(description='Transaction not found')
        }
    )
    def get(self, request, transaction_id):
        """Get EDI transaction details"""
        transaction = edi_processor.get_transaction_status(transaction_id)

        if not transaction:
            return Response(
                {'detail': 'EDI transaction not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permissions - users can only see their own provider's transactions
        if hasattr(request.user, 'provider_profile'):
            if transaction.provider != request.user.provider_profile:
                return Response(
                    {'detail': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = EDITransactionSerializer(transaction)
        return Response(serializer.data)


class EDIProviderTransactionsView(APIView):
    """View for retrieving provider's EDI transactions"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: EDITransactionSerializer(many=True)
        }
    )
    def get(self, request):
        """Get EDI transactions.
        - Providers: limited to their own provider transactions
        - Admins/Staff: access to all transactions, with optional filtering
        Supported filters: status, transaction_type (alias: type), date_from, date_to, provider_id (admin only)
        """

        # Common query parameters
        status_filter = request.query_params.get('status')
        # Support both `transaction_type` (frontend) and `type` (legacy) query keys
        transaction_type = request.query_params.get('transaction_type') or request.query_params.get('type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        # Admins can view all transactions
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            from .models import EDITransaction
            qs = EDITransaction.objects.all()

            # Optional provider filter for admins
            provider_id = request.query_params.get('provider_id') or request.query_params.get('provider')
            if provider_id:
                qs = qs.filter(provider_id=provider_id)

            # Apply filters
            if status_filter:
                qs = qs.filter(status=status_filter)
            if transaction_type:
                qs = qs.filter(transaction_type=transaction_type)
            if date_from:
                qs = qs.filter(submitted_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(submitted_at__date__lte=date_to)

            transactions = qs.order_by('-submitted_at')
        else:
            # Providers must be attached to a provider profile
            if not hasattr(request.user, 'provider_profile'):
                return Response(
                    {'detail': 'User is not associated with a provider'},
                    status=status.HTTP_403_FORBIDDEN
                )

            provider = request.user.provider_profile

            transactions = edi_processor.get_provider_transactions(
                provider=provider,
                status=status_filter,
                transaction_type=transaction_type
            )

            # Apply optional date filters for provider queries
            if date_from:
                transactions = transactions.filter(submitted_at__date__gte=date_from)
            if date_to:
                transactions = transactions.filter(submitted_at__date__lte=date_to)

        serializer = EDITransactionSerializer(transactions, many=True)
        return Response(serializer.data)


class EDIStatusUpdateView(APIView):
    """View for updating EDI transaction status (admin/provider use)"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request={
            'type': 'object',
            'properties': {
                'status': {'type': 'string', 'enum': ['ACCEPTED', 'REJECTED', 'ERROR']},
                'error_code': {'type': 'string'},
                'error_message': {'type': 'string'},
                'response_content': {'type': 'string'}
            }
        },
        responses={
            200: EDITransactionSerializer,
            400: OpenApiResponse(description='Invalid status update'),
            403: OpenApiResponse(description='Permission denied'),
            404: OpenApiResponse(description='Transaction not found')
        }
    )
    def post(self, request, transaction_id):
        """Update EDI transaction status"""
        transaction = get_object_or_404(EDITransaction, transaction_id=transaction_id)

        # Check permissions
        if hasattr(request.user, 'provider_profile'):
            if transaction.provider != request.user.provider_profile:
                return Response(
                    {'detail': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        # Admin users can update any transaction

        new_status = request.data.get('status')
        if new_status not in ['ACCEPTED', 'REJECTED', 'ERROR']:
            return Response(
                {'detail': 'Invalid status. Must be ACCEPTED, REJECTED, or ERROR'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update transaction based on status
        if new_status == 'ACCEPTED':
            transaction.mark_accepted(
                response_transaction_id=request.data.get('response_transaction_id')
            )
        elif new_status == 'REJECTED':
            transaction.mark_rejected(
                error_code=request.data.get('error_code', ''),
                error_message=request.data.get('error_message', ''),
                validation_errors=request.data.get('validation_errors')
            )
        elif new_status == 'ERROR':
            transaction.mark_error(
                error_message=request.data.get('error_message', ''),
                validation_errors=request.data.get('validation_errors')
            )

        # Update response content if provided
        if 'response_content' in request.data:
            transaction.response_content = request.data['response_content']
            transaction.save(update_fields=['response_content'])

        serializer = EDITransactionSerializer(transaction)
        return Response(serializer.data)
