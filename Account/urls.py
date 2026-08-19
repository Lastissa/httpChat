from django.urls import path, include
from . import views

urlpatterns = [
    path('signup/', views.CreateAccount.as_view(), name = 'account_signup'),
    path('username/availability/', views.GenerateUsername.as_view(), name= 'username_availability')

]
