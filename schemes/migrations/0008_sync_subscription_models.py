# Generated manually on 2025-09-18 to sync models with existing database

from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta


class Migration(migrations.Migration):

    dependencies = [
        ('schemes', '0007_add_performance_indexes'),
        ('claims', '0011_claim_rejection_date_claim_rejection_reason'),
    ]

    operations = [
        # This migration ensures the models match the existing database state
        # No database changes needed since tables already exist
        migrations.AlterModelOptions(
            name='benefitcategory',
            options={'ordering': ['name'], 'verbose_name': 'Benefit Category', 'verbose_name_plural': 'Benefit Categories'},
        ),
        migrations.AlterModelOptions(
            name='membersubscription',
            options={'ordering': ['-created_at'], 'verbose_name': 'Member Subscription', 'verbose_name_plural': 'Member Subscriptions'},
        ),
        migrations.AlterModelOptions(
            name='subscriptiontier',
            options={'ordering': ['scheme', 'sort_order', 'name'], 'unique_together': {('scheme', 'name')}, 'verbose_name': 'Subscription Tier', 'verbose_name_plural': 'Subscription Tiers'},
        ),
    ]