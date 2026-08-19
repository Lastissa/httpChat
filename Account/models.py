from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

TIER = [
    ('FREE', 'Free'),
    ('PRO', 'Pro'),
    ('PREMIUM', 'Premium')
]
SECURITY_QUESTIONS = [
    #ASK THREE QUESTION AND NOTIFY USERS THAT ANSWERS ARE SEPRATED BY SPACE AND ITS CASE SENSITIVE.
    "What is the name of you primary school favourite teacher? WHat is the name of your mother maiden name?, What is you most favourite food?",
    "..."
]

class CustomUserManager(BaseUserManager):
    def _blueprint(self, email, username, secret_question, secret_answer, password= None, *args, **kwargs):
        if not email: raise ValueError("Email Not Provided")
        email = email.upper()
        user = self.model(email, username, secret_question, secret_answer)


class CustomUser(AbstractBaseUser):
    email = models.EmailField()
    username = models.CharField(max_length=100, unique=True, db_index=True, blank=False, null= False)
    is_staff = models.BooleanField()
    is_superuser = models.BooleanField()
    date_created = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    tier = models.CharField(max_length=30, choices=TIER)
    email_verified = models.BooleanField(default=False)
    secret_question = models.CharField(max_length=100)          #   Alternate to email sending which might go wrong
    secret_answer = models.CharField(max_length=100)
    email_verified = models.BooleanField(default = False)
    
    