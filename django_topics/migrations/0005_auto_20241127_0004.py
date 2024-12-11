# -*- coding: utf-8 -*-
# Generated by Django 1.11.29 on 2024-11-27 04:04
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('django_topics', '0004_auto_20241126_2359'),
    ]

    operations = [
        migrations.AlterField(
            model_name='seasonaltopic',
            name='lang',
            field=models.CharField(choices=[('en', 'English'), ('he', 'Hebrew')], max_length=2),
        ),
    ]
