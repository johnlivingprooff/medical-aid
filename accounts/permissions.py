"""
Custom permissions for the accounts app.
"""

from rest_framework import permissions


class IsProviderOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow providers or admins to access certain views.
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Allow admins full access
        if request.user.role == 'ADMIN':
            return True

        # Allow providers access to their own data
        if request.user.role == 'PROVIDER':
            return True

        # Deny access for other roles (like patients)
        return False

    def has_object_permission(self, request, view, obj):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Allow admins full access
        if request.user.role == 'ADMIN':
            return True

        # For providers, check if the object belongs to them
        if request.user.role == 'PROVIDER':
            # Check if object has a provider field
            if hasattr(obj, 'provider'):
                return obj.provider == request.user
            # Check if object has a recipient field (for notifications)
            if hasattr(obj, 'recipient'):
                return obj.recipient == request.user
            # Check if object has a user field
            if hasattr(obj, 'user'):
                return obj.user == request.user

        return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admins to edit, but allow read access to authenticated users.
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Allow all authenticated users to read
        if request.method in permissions.SAFE_METHODS:
            return True

        # Only allow admins to write
        return request.user.role == 'ADMIN'


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow owners or admins to access objects.
    """

    def has_object_permission(self, request, view, obj):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Allow admins full access
        if request.user.role == 'ADMIN':
            return True

        # Check if object belongs to the user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'recipient'):
            return obj.recipient == request.user
        if hasattr(obj, 'provider'):
            return obj.provider == request.user

        return False