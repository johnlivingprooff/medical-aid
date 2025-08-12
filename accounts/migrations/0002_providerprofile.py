from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProviderProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('facility_name', models.CharField(max_length=150)),
                ('facility_type', models.CharField(choices=[('HOSPITAL', 'Hospital'), ('CLINIC', 'Clinic'), ('PHARMACY', 'Pharmacy'), ('LAB', 'Laboratory'), ('IMAGING', 'Imaging Center')], max_length=20)),
                ('phone', models.CharField(blank=True, max_length=50)),
                ('address', models.CharField(blank=True, max_length=255)),
                ('city', models.CharField(blank=True, max_length=100)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='provider_profile', to='accounts.user')),
            ],
        ),
    ]
