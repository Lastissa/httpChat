from django.http import JsonResponse
from django.urls import path
from . import views

urlpatterns = [
    # --- Sign up ---
    path('signup/', views.CreateAccount.as_view(), name='account_signup'),
    path('username/availability/', views.GenerateUsername.as_view(), name='username_availability'),

    # --- Login / logout ---
    path('login/', views.LoginAccount.as_view(), name='account_login'),
    path('logout/', views.LogoutAccount.as_view(), name='account_logout'),
    path('home/', views.AccountHome.as_view(), name='account_home'),  # placeholder post-login landing page

    # --- Forgot password ---
    path('password/forgot/', views.ForgotPassword.as_view(), name='account_forgot_password'),
    path('password/forgot/email/', views.ForgotPasswordEmailRequest.as_view(), name='account_forgot_password_email'),
    path('password/forgot/security/lookup/', views.ForgotPasswordSecurityLookup.as_view(), name='account_forgot_password_security_lookup'),
    path('password/forgot/security/verify/', views.ForgotPasswordSecurityVerify.as_view(), name='account_forgot_password_security_verify'),
    path('password/reset/<str:token>/', views.PasswordResetConfirm.as_view(), name='account_password_reset_confirm'),
]


