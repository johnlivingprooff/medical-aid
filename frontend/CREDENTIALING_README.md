# Credentialing Management UI

## Overview
The Credentialing Management UI provides a dashboard for managing provider credentialing requests, reviews, documents, and expiry alerts. Accessible to ADMIN and PROVIDER roles only.

## Features
- **Dashboard**: Summary of credentialing status and metrics.
- **Reviews**: List and detail view of credentialing reviews.
- **Documents**: Upload and manage credentialing documents.
- **Alerts**: View document expiry alerts.

## Endpoints
- `/api/accounts/credentialing/dashboard/` — Dashboard summary
- `/api/accounts/credentialing-reviews/` — List/retrieve reviews
- `/api/accounts/provider-credentialing-docs/` — List/upload documents
- `/api/accounts/expiry-alerts/` — Expiry alerts

## Role Access
- **ADMIN**: Full access to all credentialing features and actions (approve/reject).
- **PROVIDER**: Access to own credentialing requests, documents, and alerts.

## UI Patterns
- Empty state and loading skeletons for all tabs
- Error messages for failed API calls
- DRF pagination handled via `response.results || response`

## Usage
1. Navigate to Credentialing via sidebar (ADMIN/PROVIDER only)
2. Use tabs to view dashboard, reviews, documents, and alerts
3. Upload documents and view expiry alerts
4. ADMINs can approve/reject credentialing requests

## Development Notes
- All API calls use `credentialingApi` in `frontend/src/lib/api.ts`
- TypeScript types in `frontend/src/types/models.ts`
- UI components in `frontend/src/pages/credentialing.tsx`
- Empty state component: `frontend/src/components/ui/EmptyState.tsx`

---
For further details, see backend endpoints in `accounts/views_credentialing.py` and serializers in `accounts/serializers_credentialing.py`.
