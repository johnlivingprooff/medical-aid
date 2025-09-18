from rest_framework.permissions import IsAuthenticated


class IsAdminOnly(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and getattr(request.user, 'role', None) == 'ADMIN'


class IsAdminOrProvider(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        user_role = getattr(request.user, 'role', None)
        return user_role in ['ADMIN', 'PROVIDER']


class IsAdminProviderOrPatient(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        user_role = getattr(request.user, 'role', None)
        return user_role in ['ADMIN', 'PROVIDER', 'PATIENT']