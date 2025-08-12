from django.db import migrations, models


def populate_member_ids(apps, schema_editor):
    Patient = apps.get_model('claims', 'Patient')
    for patient in Patient.objects.all().order_by('id'):
        if not getattr(patient, 'member_id', ''):
            patient.member_id = f"MBR-{patient.id:04d}"
            patient.save(update_fields=['member_id'])


class Migration(migrations.Migration):
    dependencies = [
        ('claims', '0002_alter_claim_service_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='patient',
            name='member_id',
            field=models.CharField(blank=True, editable=False, max_length=20, unique=True),
        ),
        migrations.RunPython(populate_member_ids, migrations.RunPython.noop),
    ]
