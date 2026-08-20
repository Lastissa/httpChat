from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("django_secret_key")

DEBUG = False

AUTH_USER_MODEL = 'Account.CustomUser'

PROJECT_BASE_URL = os.getenv("PROJECT_BASE_URL")
 
ALLOWED_HOSTS = os.getenv('ALLOWED_HOST', 'localhost,').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sitemaps',  # ADDED: sitemap.xml for SEO — see HTTP_CHAT_APP/urls.py + Account/sitemaps.py

    'Account',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'Account.middleware.MaintanceMiddleWare',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'HTTP_CHAT_APP.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'UTILITY.Static.reusables'
            ],
        },
    },
]

WSGI_APPLICATION = 'HTTP_CHAT_APP.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'

# MAILERS = {
#     'default': {
#         'BACKEND': 'django.core.mail.backends.console.EmailBackend',
#     },
# }
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'  # prints "sent" mail to the console/log.
                                                                    # Swap for a real SMTP backend in production.
DEFAULT_FROM_EMAIL = f'no-reply@{ALLOWED_HOSTS[0] if ALLOWED_HOSTS[0] != "*" else "httpchat.local"}'

REMOVE_SERVICE_MODE = os.getenv('REMOVE_SERVICE_MODE') or True    #   Auto On if this is missing in the env


CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

STATIC_ROOT = BASE_DIR / 'staticfiles'

# --- Auth redirects ---
LOGIN_URL = 'account_login'
LOGIN_REDIRECT_URL = 'account_home'
LOGOUT_REDIRECT_URL = 'account_login'

