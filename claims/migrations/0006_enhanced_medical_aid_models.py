# Generated migration for enhanced medical aid models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('claims', '0005_add_patient_status'),
        ('schemes', '0001_initial'),
    ]

    operations = [
        # Patient model enhancements
        migrations.AddField(
            model_name='patient',
            name='enrollment_date',
            field=models.DateField(auto_now_add=True, help_text='Date of enrollment in the scheme'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='patient',
            name='benefit_year_start',
            field=models.DateField(blank=True, help_text='Custom benefit year start (if different from enrollment)', null=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='principal_member',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='dependents', to='claims.patient'),
        ),
        migrations.AddField(
            model_name='patient',
            name='relationship',
            field=models.CharField(choices=[('PRINCIPAL', 'Principal Member'), ('SPOUSE', 'Spouse'), ('CHILD', 'Child'), ('DEPENDENT', 'Other Dependent')], default='PRINCIPAL', max_length=20),
        ),
        migrations.AddField(
            model_name='patient',
            name='phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='patient',
            name='emergency_contact',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='patient',
            name='emergency_phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name='patient',
            name='status',
            field=models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('SUSPENDED', 'Suspended'), ('TERMINATED', 'Terminated')], default='ACTIVE', max_length=20),
        ),

        # Claim model enhancements
        migrations.AddField(
            model_name='claim',
            name='date_of_service',
            field=models.DateField(help_text='Date when the service was provided', null=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='claim',
            name='priority',
            field=models.CharField(choices=[('LOW', 'Low'), ('NORMAL', 'Normal'), ('HIGH', 'High'), ('URGENT', 'Urgent')], default='NORMAL', max_length=10),
        ),
        migrations.AddField(
            model_name='claim',
            name='processed_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='claim',
            name='processed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='processed_claims', to='accounts.user'),
        ),
        migrations.AddField(
            model_name='claim',
            name='diagnosis_code',
            field=models.CharField(blank=True, help_text='ICD-10 or other diagnosis code', max_length=20),
        ),
        migrations.AddField(
            model_name='claim',
            name='procedure_code',
            field=models.CharField(blank=True, help_text='CPT or other procedure code', max_length=20),
        ),
        migrations.AddField(
            model_name='claim',
            name='preauth_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='claim',
            name='preauth_expiry',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='claim',
            name='rejection_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='claim',
            name='rejection_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='claim',
            name='status',
            field=models.CharField(choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('REQUIRES_PREAUTH', 'Requires Pre-authorization'), ('INVESTIGATING', 'Under Investigation')], default='PENDING', max_length=20),
        ),

        # SchemeBenefit model enhancements
        migrations.AddField(
            model_name='schemebenefit',
            name='deductible_amount',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Amount patient pays before coverage kicks in', max_digits=12),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='copayment_percentage',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Percentage of cost patient must pay', max_digits=5),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='copayment_fixed',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Fixed amount patient must pay per visit', max_digits=12),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='requires_preauth',
            field=models.BooleanField(default=False, help_text='Requires pre-authorization before treatment'),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='preauth_limit',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Amount above which pre-auth is required', max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='waiting_period_days',
            field=models.PositiveIntegerField(default=0, help_text='Days to wait before benefit is active'),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='network_only',
            field=models.BooleanField(default=False, help_text='Only cover in-network providers'),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='effective_date',
            field=models.DateField(auto_now_add=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='schemebenefit',
            name='expiry_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='schemebenefit',
            name='coverage_period',
            field=models.CharField(choices=[('PER_VISIT', 'Per Visit'), ('MONTHLY', 'Monthly'), ('QUARTERLY', 'Quarterly'), ('YEARLY', 'Yearly'), ('LIFETIME', 'Lifetime'), ('BENEFIT_YEAR', 'Benefit Year')], default='BENEFIT_YEAR', max_length=20),
        ),
        migrations.AlterField(
            model_name='schemebenefit',
            name='coverage_amount',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Maximum coverage amount', max_digits=12, null=True),
        ),

        # Invoice model enhancements
        migrations.AddField(
            model_name='invoice',
            name='amount_paid',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='invoice',
            name='payment_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='payment_reference',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='invoice',
            name='patient_deductible',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='invoice',
            name='patient_copay',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='invoice',
            name='patient_coinsurance',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='invoice',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='provider_bank_account',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='invoice',
            name='provider_bank_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='payment_status',
            field=models.CharField(choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('PARTIAL', 'Partially Paid'), ('CANCELLED', 'Cancelled'), ('DISPUTED', 'Disputed')], default='PENDING', max_length=20),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='amount',
            field=models.DecimalField(decimal_places=2, help_text='Amount approved for payment', max_digits=12),
        ),

        # Add new indexes
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS claims_claim_provider_status_date_idx ON claims_claim (provider_id, status, date_submitted);",
            reverse_sql="DROP INDEX IF EXISTS claims_claim_provider_status_date_idx;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS claims_claim_date_of_service_status_idx ON claims_claim (date_of_service, status);",
            reverse_sql="DROP INDEX IF EXISTS claims_claim_date_of_service_status_idx;"
        ),
    ]
