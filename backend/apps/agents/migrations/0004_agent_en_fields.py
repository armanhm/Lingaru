# Generated for v2.0.0 multi-language agent metadata.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agents', '0003_agent_system_prompt_en'),
    ]

    operations = [
        migrations.AddField(
            model_name='agent',
            name='name_en',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='agent',
            name='tagline_en',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
        migrations.AddField(
            model_name='agent',
            name='description_en',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='agent',
            name='best_for_en',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='agent',
            name='capabilities_en',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='agent',
            name='suggested_questions_en',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
