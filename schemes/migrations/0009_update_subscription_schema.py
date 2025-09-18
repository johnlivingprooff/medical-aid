# Migration to update subscription models to match current definitions

from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('schemes', '0008_sync_subscription_models'),
    ]

    operations = [
        # Add missing fields to BenefitCategory
        migrations.AddField(
            model_name='benefitcategory',
            name='category_type',
            field=models.CharField(
                choices=[('CORE', 'Core Benefits'), ('PREMIUM', 'Premium Benefits'), ('ADD_ON', 'Add-on Benefits')],
                default='CORE',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='benefitcategory',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='benefitcategory',
            name='created_at',
            field=models.DateTimeField(default=timezone.now),
        ),
        migrations.AddField(
            model_name='benefitcategory',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),

        # Add missing fields to SubscriptionTier
        migrations.AddField(
            model_name='subscriptiontier',
            name='is_default',
            field=models.BooleanField(default=False, help_text='Default tier for new members'),
        ),

        # Update MemberSubscription fields
        migrations.RenameField(
            model_name='membersubscription',
            old_name='patient_id',
            new_name='member_id',
        ),
        migrations.AddField(
            model_name='membersubscription',
            name='is_prorated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='membersubscription',
            name='total_paid',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text='Total amount paid for this subscription'),
        ),
        migrations.AddField(
            model_name='membersubscription',
            name='outstanding_balance',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, help_text='Current outstanding balance'),
        ),
        migrations.AddField(
            model_name='membersubscription',
            name='cancelled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # Update foreign key relationships
        migrations.AlterField(
            model_name='membersubscription',
            name='member',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='member_subscription',
                to='claims.patient'
            ),
        ),

        # Update BenefitType to include category relationship
        migrations.AddField(
            model_name='benefittype',
            name='category',
            field=models.ForeignKey(
                blank=True,
                help_text='Category this benefit belongs to',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='benefit_types',
                to='schemes.benefitcategory'
            ),
        ),
    ]