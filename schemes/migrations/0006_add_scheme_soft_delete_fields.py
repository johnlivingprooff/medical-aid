# Generated migration for scheme soft delete fields

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('schemes', '0005_schemeauditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='schemecategory',
            name='is_active',
            field=models.BooleanField(default=True, help_text='Whether this scheme is active and accepting new members'),
        ),
        migrations.AddField(
            model_name='schemecategory',
            name='deactivated_date',
            field=models.DateTimeField(blank=True, help_text='When the scheme was deactivated', null=True),
        ),
        migrations.AddField(
            model_name='schemecategory',
            name='deactivated_by',
            field=models.ForeignKey(blank=True, help_text='User who deactivated this scheme', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deactivated_schemes', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='schemecategory',
            name='deactivation_reason',
            field=models.TextField(blank=True, help_text='Reason for deactivation'),
        ),
        migrations.AddField(
            model_name='schemecategory',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='schemecategory',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddIndex(
            model_name='schemecategory',
            index=models.Index(fields=['is_active'], name='schemes_sch_is_acti_7f8a6e_idx'),
        ),
        migrations.AddIndex(
            model_name='schemecategory',
            index=models.Index(fields=['is_active', 'created_at'], name='schemes_sch_is_acti_0b8e4a_idx'),
        ),
        migrations.AddIndex(
            model_name='schemecategory',
            index=models.Index(fields=['deactivated_date'], name='schemes_sch_deactiv_5f2a1c_idx'),
        ),
    ]