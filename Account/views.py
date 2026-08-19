
import random
import string

from django.http import JsonResponse
from django.views import View
from django.shortcuts import redirect, render
from django.contrib.auth import get_user_model
from django.core.validators import EmailValidator
from django.contrib import messages
from django.core.cache import cache
import json

User = get_user_model()

class CreateAccount(View):
    """
    THIS VIEW HANDLES ACCOUTN CREATION FOR ALL USER TYPE
    GET - Method
    Returns the template to render for this view
    POST - Method
    receiver of the form data
    """
    def get(self, request): return render(request, 'html/signup.html')
    def post(self, request):
        key = request.META['REMOTE_ADDR']
        value = cache.get(key) or "x"
        if cache.get(key):cache.set(key, value + "x", timeout=len(value)*2)   #increae the lenght
        else:cache.set(key, "x", timeout=2)     
            
        if len(value) >= 5:
            cache.set(key=key, value=value, timeout=60)
            messages.info(request, message="Spam dectected, you have been banned from this page for 1 minute, Wait for one minutes before trying again else the time resets".upper())
            return redirect("account_signup")
        
        
        print(value)   
        data = request.POST
        try:
            email = data['email']
            username = data['username']
            password = data['password']
            password_confirm = data['password_confirm']
            secret_question = data['secret_question']
            secret_answer_1 = data['secret_answer_1']
            secret_answer_2 = data['secret_answer_2']
            secret_answer_3 = data['secret_answer_3']
        except Exception as e: return JsonResponse({'message': str(e)})
        #check two passwords
        import hmac
        if not hmac.compare_digest(password, password_confirm) : return JsonResponse({'message': 'Password do not match'}) 
        
        #validate_email
        try: EmailValidator(email)
        except:return JsonResponse({"message":f'{email} is not a valid email'})
        
        
        messages.info(request, message="Account Created Successfully")
        return JsonResponse({'m': ''})
        # redirect("account_login")

        
    

class GenerateUsername(View):
    """Check username availability and generate suggestions if taken"""
    
    def post(self, request):
        try:
            data = json.loads(request.body)
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            if not username:return JsonResponse({'available': False,'message': 'Username is required'})
            # Check if username exists (case-insensitive)
            user_exists = User.objects.filter(username__iexact=username).exists()
            if not user_exists: return JsonResponse({'available': True,'message': 'Username is available'})
            # Username is taken - generate suggestions
            suggestions = self.generate_suggestions(username, email)
            return JsonResponse({
                'available': False,
                'message': 'Username is already taken',
                'suggested_username': suggestions[0] if suggestions else None,
                'suggestions': suggestions
            })
            
        except json.JSONDecodeError:return JsonResponse({'available': False,'message': 'Invalid request format'})
        except Exception as e:return JsonResponse({'available': False,'message': 'An error occurred checking username'})
    
    def generate_suggestions(self, username, email=''):
        """Generate personalized username suggestions"""
        suggestions = []
        base = username
        # 1. Try adding numbers (1-5)
        for i in range(1, 6):
            suggestion = f"{base}{i}"
            if not User.objects.filter(username__iexact=suggestion).exists():
                suggestions.append(suggestion)
                if len(suggestions) >= 5:
                    break
        
        # 2. Try underscore variations
        if '_' not in base and len(suggestions) < 5:
            for suffix in ['_', '_1', '_2']:
                suggestion = f"{base}{suffix}"
                if not User.objects.filter(username__iexact=suggestion).exists():
                    suggestions.append(suggestion)
                    if len(suggestions) >= 5:
                        break
        
        # 4. If email provided, try using email prefix (personalized)
        if email and '@' in email and len(suggestions) < 5:
            email_prefix = email.split('@')[0]
            if base and base != username:
                # Try email prefix as-is
                if not User.objects.filter(username__iexact=base).exists():
                    suggestions.insert(0, base)  # Prioritize this suggestion
                else:
                    # Try email prefix with numbers
                    for i in range(1, 4):
                        suggestion = f"{base}{i}"
                        if not User.objects.filter(username__iexact=suggestion).exists():
                            suggestions.insert(0, suggestion)
                            break
        # 6. Random fallback if no suggestions generated
        if not suggestions:
            # Generate random 3-4 digit suffix
            suffix = ''.join(random.choices(string.digits, k=4))
            suggestion = f"{base}{suffix}"
            if not User.objects.filter(username__iexact=suggestion).exists():
                suggestions.append(suggestion)
            else:
                # Last resort - generate completely random
                for _ in range(10):
                    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
                    suggestion = f"{base}_{random_suffix}"
                    if not User.objects.filter(username__iexact=suggestion).exists():
                        suggestions.append(suggestion)
                        break
        
        return suggestions[:5]  # Return top 5 suggestions

    
    
class StaffSignUp(View):
    """
    GET show the template for staff signup with access key needed from an admin first before they can proceed to set up their account
    """
    