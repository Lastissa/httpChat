from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone

TIER = [
    ('FREE', 'Free'),
    ('PRO', 'Pro'),
    ('PREMIUM', 'Premium')
]


class CustomUserManager(BaseUserManager):

    def create_user(self, email, username, password=None, secret_question='', secret_answer='', **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        if not username:
            raise ValueError('Username is required.')

        email = email.upper()   #   I do not like the normalize as per it mean iam not sure of what incoming email will be
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_active', True)

        user = self.model(email=email, username=username, **extra_fields)
        if password:user.set_password(password)
        else:user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, username, password, **extra_fields)


class CustomUser(AbstractBaseUser):
    email = models.EmailField(unique=True) 
    username = models.CharField(max_length=100, unique=True, db_index=True, blank=False, null=False)
    is_staff = models.BooleanField(default=False) 
    is_superuser = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']
    
    def has_module_perms(self, app_label):
        return self.is_superuser
    
    def has_perm(self, app_label):
        # print(app_label)
        return True
    
    def __str__(self):
        return self.username


class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    tier = models.CharField(max_length=30, choices=TIER, default='FREE')
    email_verified = models.BooleanField(default=False)
    secret_question = models.CharField(max_length=300)
    secret_answer = models.CharField(max_length=150)

    def __str__(self):
        return f"Profile for {self.user.eusername}"

class SecurityAnswerSet(models.Model):
    """
    One row per user, storing which security-question SET they
    chose (by index into UTILITY.Static.security_questions, not
    the full question text
    The answrs will be hashed in the view
    ### NOTE: THIS MEAN security_questions SHOULD NTO BE EDITED
    """
    
    ##############################################
    #  just founf out that just as i can do Profile.user
    # User.profile too can also be done AND
    # thats what this related_name is for as its the key to be used for search from User directly
    #############################################
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='security_answer_set',
    )
    question_set_index = models.PositiveSmallIntegerField()
    answer_1_hash = models.CharField(max_length=255)
    answer_2_hash = models.CharField(max_length=255)
    answer_3_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Security answers for {self.user}'


class PasswordResetToken(models.Model):
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    RESET_TOKEN_LIFETIME_MINUTES = 10
    CURRENT_MAX_TOKEN = 6
    

    @classmethod
    def issue_for(cls, user):
        """Create (and return) a fresh token for this user, valid for
        RESET_TOKEN_LIFETIME_MINUTES. Does not invalidate older
        tokens — they simply expire on their own , and
        redeeming any valid one marks it (and only it) used."""
        import random, string
        letter_nd_number = string.digits + string.ascii_letters
        token = random.choices(letter_nd_number, k = cls.CURRENT_MAX_TOKEN)
        token = "".join(token)
        return cls.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timezone.timedelta(minutes=cls.RESET_TOKEN_LIFETIME_MINUTES),
        )

    def is_valid(self):
        return (not self.used) and self.expires_at > timezone.now()

    def __str__(self):
        return f'Password reset token for {self.user} (used={self.used})'
