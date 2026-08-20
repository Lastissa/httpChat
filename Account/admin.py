from django.contrib import admin
from .models import CustomUser, Profile, SecurityAnswerSet, PasswordResetToken

admin.site.register([CustomUser, Profile, SecurityAnswerSet, PasswordResetToken])