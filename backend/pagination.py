"""
Optimized pagination classes for better performance with large datasets
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from collections import OrderedDict


class OptimizedPagination(PageNumberPagination):
    """
    Optimized pagination that uses PageNumberPagination for better performance
    with large datasets compared to LimitOffsetPagination.
    """
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        """
        Return a paginated style Response object with optimized metadata.
        """
        return Response(OrderedDict([
            ('count', self.page.paginator.count),
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('results', data),
            ('page_size', self.page_size),
            ('current_page', self.page.number),
            ('total_pages', self.page.paginator.num_pages),
        ]))


class LargeDatasetPagination(PageNumberPagination):
    """
    Specialized pagination for very large datasets (>10k records).
    Uses smaller page sizes and optimized metadata.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50

    def get_paginated_response(self, data):
        """
        Minimal metadata response for large datasets to reduce overhead.
        """
        return Response(OrderedDict([
            ('count', self.page.paginator.count),
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('results', data),
        ]))


class CursorPagination:
    """
    Cursor-based pagination for time-series data (claims, invoices).
    More efficient for large datasets with frequent updates.
    """
    # This would be implemented if needed for real-time data
    # For now, we'll stick with PageNumberPagination for simplicity
    pass