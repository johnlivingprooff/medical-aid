from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schemes', '0002_benefittype_alter_schemebenefit_benefit_type'),
    ]

    def compute_prices(apps, schema_editor):
        SchemeCategory = apps.get_model('schemes', 'SchemeCategory')
        SchemeBenefit = apps.get_model('schemes', 'SchemeBenefit')
        from django.db.models import F, Sum
        for scheme in SchemeCategory.objects.all():
            total = (
                SchemeBenefit.objects.filter(scheme=scheme)
                .annotate(final=F('coverage_amount') * F('coverage_limit_count'))
                .aggregate(total=Sum('final'))['total'] or 0
            )
            scheme.price = total
            scheme.save(update_fields=['price'])

    operations = [
        migrations.AddField(
            model_name='schemecategory',
            name='price',
            field=models.DecimalField(max_digits=12, decimal_places=2, default=0),
        ),
        migrations.RunPython(compute_prices, reverse_code=migrations.RunPython.noop),
    ]
