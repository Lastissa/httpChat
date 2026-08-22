"""
Account/views.py
=====================================================================
All POST endpoints here speak the "hybrid" JSON contract used by
static/base_template.js's submitFormAsJson() helper:

    Validation problem  -> JsonResponse({'fieldErrors': {...}}, status=400)
    Success             -> JsonResponse({'success': True, 'redirect': '...'})

'fieldErrors' keys must match the form field's `name=` attribute so
the frontend can attach each message to the right input.
"""

import json

from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import EmailValidator
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin

from UTILITY.Static import security_questions, static
from UTILITY.abstraction import _parse_json_body, _rate_limited
from .models import PasswordResetToken, SecurityAnswerSet

User = get_user_model()

email_validator = EmailValidator() 


# =====================================================================
# Sign up
# =====================================================================

class CreateAccount(View):
    """
    GET  -> renders the signup page.
    POST -> validates + creates the account. See module docstring for
            the JSON response contract.
    """

    def get(self, request):
        return render(request, 'html/signup.html', {
            'security_questions': list(enumerate(security_questions)),
        })

    def post(self, request):
        if _rate_limited('signup_attempts', request):
            return JsonResponse(
                {'message': 'Too many attempts, Please wait for 60 seconds and try again.'},
                status=429,
            )

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        errors = {}

        email = (data.get('email') or '').strip()
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        password_confirm = data.get('password_confirm') or ''
        question_index_raw = data.get('secret_question')
        answer_1 = (data.get('secret_answer_1') or '').strip()
        answer_2 = (data.get('secret_answer_2') or '').strip()
        answer_3 = (data.get('secret_answer_3') or '').strip()

        # --- Email ---
        if not email:
            errors['email'] = 'Email is required.'
        else:
            try:
                email_validator(email)
                if User.objects.filter(email__iexact=email).exists():
                    errors['email'] = 'An account with this email already exists.'
            except ValidationError:
                errors['email'] = 'Enter a valid email address.'

        # --- Username ---
        if not username:
            errors['username'] = 'Username is required.'
        elif User.objects.filter(username__iexact=username).exists():
            errors['username'] = 'That username is already taken.'

        # --- Password ---
        if not password:
            errors['password'] = 'Password is required.'
        else:
            try:
                # Runs every validator configured in
                # AUTH_PASSWORD_VALIDATORS (min length, similarity to
                # user attrs, common-password list, not-all-numeric) —
                # the client-side "8 characters" check in signup.js is
                # only a fast first pass; this is the real check.
                validate_password(password)
            except ValidationError as v:
                errors['password'] = ' '.join(v.messages)

        if not password_confirm:
            errors['password_confirm'] = 'Please confirm your password.'
        elif password and password_confirm != password:
            errors['password_confirm'] = 'Passwords do not match.'

        # --- Security question set + answers ---
        question_index = None
        if question_index_raw in (None, ''):
            errors['secret_question'] = 'Choose a set of security questions as they are important for account recovery.'
        else:
            try:
                question_index = int(question_index_raw)
                if not (0 <= question_index < len(security_questions)): #   Enfore that theint is withint the list of all possible question from Static
                    raise ValueError
            except (TypeError, ValueError):
                errors['secret_question'] = 'Choose a valid set of security questions.'

        if question_index is not None:
            if not (answer_1 and answer_2 and answer_3):
                errors['secret_answer_1'] = 'Answer all 3 security questions.'

        #   Return all possible error here if found
        if errors:return JsonResponse({'fieldErrors': errors}, status=400)

        # --- Everything validated: create the account ---
        user = User.objects.create_user(username=username, email=email, password=password)
        SecurityAnswerSet.objects.create(
            user=user,
            question_set_index=question_index,
            # Hashed with the same algorithm as passwords — these are
            # effectively a second password, and the original code
            # would have stored them in plain text.
            answer_1_hash=_hash_answer(answer_1),
            answer_2_hash=_hash_answer(answer_2),
            answer_3_hash=_hash_answer(answer_3),
        )

        messages.success(request, 'Account created successfully.')
        return JsonResponse({'success': True, 'redirect': reverse('account_login')})


def _hash_answer(raw_answer):
    """
    Security answers are case-sensitive by design (signup.html already
    tells the user this) and hashed with Django's password hasher —
    same trust model as an actual password, since in this project they
    function as an alternate credential.
    """
    from django.contrib.auth.hashers import make_password
    return make_password(raw_answer)


def _check_answer(raw_answer, hashed_answer):
    from django.contrib.auth.hashers import check_password
    return check_password(raw_answer, hashed_answer)


class GenerateUsername(View):
    """Check username availability and suggest alternatives if taken.."""

    def post(self, request):
        if _rate_limited("username-check", request, limit=10, window_seconds=5):
            return JsonResponse(
                {'available': False, 'rate_limited': True, 'message': 'Too many attempts. Please wait for 5 seconds.'},
                status=429,
            )
        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip()

        if not username:
            return JsonResponse({'available': False, 'message': 'Username is required'}, status=400)

        if not User.objects.filter(username__iexact=username).exists():
            return JsonResponse({'available': True, 'message': 'Username is available'})

        suggestions = self._generate_suggestions(username, email)
        return JsonResponse({
            'available': False,
            'message': 'Username is already taken',
            'suggested_username': suggestions[0] if suggestions else None,
            'suggestions': suggestions,
        })

    def _generate_suggestions(self, username, email=''):
        suggestions = []
        base = username

        for i in range(1, 6):
            candidate = f'{base}{i}'
            if not User.objects.filter(username__iexact=candidate).exists():
                suggestions.append(candidate)
                if len(suggestions) >= 5:
                    break

        if '_' not in base and len(suggestions) < 5:
            for suffix in ['_', '_1', '_2']:
                candidate = f'{base}{suffix}'
                if not User.objects.filter(username__iexact=candidate).exists():
                    suggestions.append(candidate)
                    if len(suggestions) >= 5:
                        break

        if email and '@' in email and len(suggestions) < 5:
            email_prefix = email.split('@')[0]
            if email_prefix and email_prefix != username and not User.objects.filter(username__iexact=email_prefix).exists():
                suggestions.insert(0, email_prefix)
                
        #   Go sway and use totally random suggestion
        if not suggestions:
            import random, string
            for _ in range(10):
                candidate = f'{base}_{"".join(random.choices(string.ascii_lowercase + string.digits, k=5))}'
                if not User.objects.filter(username__iexact=candidate).exists():
                    suggestions.append(candidate)
                    break

        return suggestions[:5]


# =====================================================================
# Login / Logout
# =====================================================================

class LoginAccount(View):
    def get(self, request):
        return render(request, 'html/login.html')

    def post(self, request):
        if _rate_limited('login_attempts', request, limit=8, window_seconds=60):
            return JsonResponse(
                {'message': 'Too many login attempts. Please wait a minute and try again.'},
                status=429,
            )

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        username = (data.get('username') or '').strip()
        password = data.get('password') or ''

        if not username or not password:
            return JsonResponse(
                {'fieldErrors': {'password': 'Enter your username and password.'}},
                status=400,
            )
        if "@" in username:
            return JsonResponse(
                {'fieldErrors': {'username': 'Email dectected, currently only username login is allowed.'}},
                status=400,
            )
        user = authenticate(request, username=username, password=password)
        if user is None:
            # Deliberately generic + attached to the password field
            # only (not "username" or "password" separately) so this
            # can't be used to enumerate which usernames exist.
            return JsonResponse(
                {'fieldErrors': {'password': 'Incorrect username or password.'}},
                status=400,
            )
        if not user.is_active:
            return JsonResponse(
                {'fieldErrors': {'password': 'This account is inactive. Contact support.'}},
                status=400,
            )

        auth_login(request, user)
        messages.success(request, f'Welcome back, {user.username}.')
        return JsonResponse({'success': True, 'redirect': reverse('account_home')})


class LogoutAccount(View):
    def post(self, request):
        auth_logout(request)
        messages.info(request, 'You have been logged out.')
        return redirect('account_login')
    
    def get(self, request):
        return self.post(request)


class AccountHome(LoginRequiredMixin, View):
    """
    Minimal placeholder landing page after login. The chat interface
    itself is out of scope for this refactor — this exists purely so
    LoginAccount has a real, working redirect target instead of a
    404. Swap this out once the actual chat UI exists.
    """

    def get(self, request):
        return render(request, 'html/home.html')


class Landing(View):
    """
    Public landing page at the base domain ("/"). Minimal by design —
    just enough to greet a first-time visitor and point them at Login
    or Sign up. 
    """

    def get(self, request):
        # if request.user.is_authenticated:
        #     return redirect('account_home')
        return render(request, 'html/landing.html')


# =====================================================================
# Forgot password — email tab
# =====================================================================

class ForgotPassword(View):
    """Renders the forgot-password page with its two tabs (email /
    security question). Both tabs POST to their own endpoint."""

    def get(self, request):
        return render(request, 'html/forgot_password.html')


class ForgotPasswordEmailRequest(View):
    """
    POST: user submits an email address.
    This is for password reset pertaning to email
    """

    GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link to it."

    def post(self, request):
        if _rate_limited('pw_reset_email', request, limit=5, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        email = (data.get('email') or '').strip()
        try:
            email_validator(email)
        except ValidationError:
            return JsonResponse({'fieldErrors': {'email': 'Enter a valid email address.'}}, status=400)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            token = PasswordResetToken.issue_for(user)
            reset_url = request.build_absolute_uri(
                reverse('account_password_reset_confirm', args=[token.token])
            )
         
            send_mail(
                subject='Reset your password',
                message=f'Use this link to reset your password (expires in '
                        f'{PasswordResetToken.RESET_TOKEN_LIFETIME_MINUTES} minutes): {reset_url}',
                from_email=None,  # falls back to DEFAULT_FROM_EMAIL
                recipient_list=[email],
            )

        return JsonResponse({'success': True, 'message': self.GENERIC_MESSAGE})


# =====================================================================
# Forgot password — security-question tab
# =====================================================================

SECURITY_RESET_SESSION_KEY = 'pw_reset_candidate_user_id'   #    I want to add this to the session so i can verify user did not fake response under the pretese of being another user


class ForgotPasswordSecurityLookup(View):
    """
    Step 1 of the security-question tab: user submits a username or
    email. If a matching account with a saved SecurityAnswerSet
    exists, we return the (already-public, non-secret) question text
    for that set and stash the candidate user's id in the SESSION —
    not sent back to the client — so step 2 can't be tricked into
    checking answers against a different account than the one that
    was actually looked up here.
    """

    def post(self, request):
        if _rate_limited('pw_reset_sq_lookup', request, limit=8, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        identifier = (data.get('identifier') or '').strip()
        if not identifier:
            return JsonResponse({'fieldErrors': {'identifier': 'Enter your username or email.'}}, status=400)

        user = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(email__iexact=identifier).first()

        answer_set = SecurityAnswerSet.objects.filter(user=user).first() if user else None
        if not answer_set:
            return JsonResponse(
                {'fieldErrors': {'identifier': 'No account with security questions was found for that username/email.'}},
                status=400,
            )

        request.session[SECURITY_RESET_SESSION_KEY] = user.pk
        request.session.set_expiry(600)  # 10 minutes to finish the flow

        questions = [q.strip() for q in security_questions[answer_set.question_set_index].split(',') if q.strip()]
        return JsonResponse({'success': True, 'questions': questions})


class ForgotPasswordSecurityVerify(View):
    """
    This works only for the 3 security question aspect
    If they are valid, redirect user to the same place forget email would have gone
    This mean at the end, only one way of truly changing password exists.
    """

    def post(self, request):
        if _rate_limited('pw_reset_sq_verify', request, limit=8, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        user_id = request.session.get(SECURITY_RESET_SESSION_KEY)
        if not user_id:
            return JsonResponse(
                {'message': 'Your session expired. Please start over.'},
                status=400,
            )

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        answer_set = SecurityAnswerSet.objects.filter(user_id=user_id).first()
        if not answer_set:
            #   This can only mean the user did not truly signup the real way user is expected tos ginup
            return JsonResponse({'message': 'Its Almost Impossible for this to happen to a real user. Contact support'}, status=400)

        submitted = [
            (data.get('answer_1') or '').strip(),
            (data.get('answer_2') or '').strip(),
            (data.get('answer_3') or '').strip(),
        ]
        stored_hashes = [answer_set.answer_1_hash, answer_set.answer_2_hash, answer_set.answer_3_hash]

        all_correct = all(_check_answer(incoming, stored) for incoming, stored in zip(submitted, stored_hashes))
        if not all_correct:
            return JsonResponse(
                {'fieldErrors': {'answer_1': 'One or more answers are incorrect.'}},
                status=400,
            )

        del request.session[SECURITY_RESET_SESSION_KEY] #   This remove the key from the session dic itself
        token = PasswordResetToken.issue_for(answer_set.user)
        return JsonResponse({
            'success': True,
            'redirect': reverse('account_password_reset_confirm', args=[token.token]),
        })


# =====================================================================
# Shared "set a new password" step (reached from either tab)
# =====================================================================

class PasswordResetConfirm(View):
    def get(self, request, token):
        reset_token = PasswordResetToken.objects.filter(token=token).first()
        if not reset_token or not reset_token.is_valid():
            messages.error(request, 'That link is invalid or has expired.')
            return redirect('account_forgot_password')
        return render(request, 'html/password_reset_confirm.html', {'token': token})

    def post(self, request, token):
        reset_token = PasswordResetToken.objects.filter(token=token).first()
        if not reset_token or not reset_token.is_valid():
            return JsonResponse({'message': 'That reset link is invalid or has expired.'}, status=400)

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        password = data.get('password') or ''
        password_confirm = data.get('password_confirm') or ''

        errors = {}
        if not password:
            errors['password'] = 'Password is required.'
        else:
            try:
                validate_password(password, user=reset_token.user)
            except ValidationError as e:
                errors['password'] = str(e)
        if password and password_confirm != password:
            errors['password_confirm'] = 'Passwords do not match.'

        if errors:
            return JsonResponse({'fieldErrors': errors}, status=400)

        user = reset_token.user
        user.set_password(password)
        user.save(update_fields=['password'])

        reset_token.used = True
        reset_token.save(update_fields=['used'])

        messages.success(request, 'Your password has been reset. Please log in.')
        return JsonResponse({'success': True, 'redirect': reverse('account_login')})


# =====================================================================
# Forgot username
# =====================================================================
# Mirrors the forgot-password flow's two-tab shape (email / security
# question) — same reasoning, same anti-enumeration + session-linking
# precautions, but with two differences forced by what's actually
# being recovered:
#   1. There's no "set a new value" step at the end. Password reset
#      hands off to PasswordResetConfirm; here, success just means
#      returning the username itself in the response.
#   2. The security-question tab's identifier is EMAIL ONLY, not
#      "username or email" — a user going through this flow doesn't
#      have their username to type in the first place.
# =====================================================================

class ForgotUsername(View):
    """Renders the forgot-username page with its two tabs."""

    def get(self, request):
        return render(request, 'html/forgot_username.html')


class ForgotUsernameEmailRequest(View):
    """
    POST: user submits an email address. If an account exists for it,
    email them their username. Generic response either way — same
    anti-enumeration reasoning as ForgotPasswordEmailRequest.
    """

    GENERIC_MESSAGE = "If an account exists for that email, we've sent the username for it."

    def post(self, request):
        if _rate_limited('username_recovery_email', request, limit=5, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        email = (data.get('email') or '').strip()
        try:
            email_validator(email)
        except ValidationError:
            return JsonResponse({'fieldErrors': {'email': 'Enter a valid email address.'}}, status=400)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            send_mail(
                subject=f'Your {static.project_name} username',
                message=f'Your username is: {user.username}',
                from_email=None,  # falls back to DEFAULT_FROM_EMAIL
                recipient_list=[email],
            )

        return JsonResponse({'success': True, 'message': self.GENERIC_MESSAGE})


USERNAME_RECOVERY_SESSION_KEY = 'username_recovery_candidate_user_id'  # deliberately its own key, separate from SECURITY_RESET_SESSION_KEY, so a half-finished password reset can't be reused to finish a username lookup or vice versa


class ForgotUsernameSecurityLookup(View):
    """
    Step 1; look up the account by EMAIL (not "username or email" —
    see module note above) and, if it has a saved SecurityAnswerSet,
    return that set's question text. put the candidate user's id
    in the session, same pattern as ForgotPasswordSecurityLookup.
    """

    def post(self, request):
        if _rate_limited('username_recovery_sq_lookup', request, limit=8, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        email = (data.get('identifier') or '').strip()
        if not email:
            return JsonResponse({'fieldErrors': {'identifier': 'Enter your email.'}}, status=400)

        user = User.objects.filter(email__iexact=email).first()

        answer_set = SecurityAnswerSet.objects.filter(user=user).first() if user else None
        if not answer_set:
            return JsonResponse(
                {'fieldErrors': {'identifier': 'No account with security questions was found for this email.'}},
                status=400,
            )

        request.session[USERNAME_RECOVERY_SESSION_KEY] = user.pk
        request.session.set_expiry(600)  # 10 minutes to finish the flow

        questions = [q.strip() for q in security_questions[answer_set.question_set_index].split(',') if q.strip()]
        return JsonResponse({'success': True, 'questions': questions})


class ForgotUsernameSecurityVerify(View):
    """
    Step 2: verify answers. Unlike the password flow, there's nothing
    to hand off to afterwards, so a correct answer set returns the
    username directly in this response instead of a redirect.
    """

    def post(self, request):
        if _rate_limited('username_recovery_sq_verify', request, limit=8, window_seconds=60):
            return JsonResponse({'message': 'Too many attempts. Please wait a minute and try again.'}, status=429)

        user_id = request.session.get(USERNAME_RECOVERY_SESSION_KEY)
        if not user_id:
            return JsonResponse(
                {'message': 'Your session expired. Please start over.'},
                status=400,
            )

        data, error_response = _parse_json_body(request)
        if error_response:
            return error_response

        answer_set = SecurityAnswerSet.objects.filter(user_id=user_id).first()
        if not answer_set:
            return JsonResponse({'message': 'Its Almost Impossible for this to happen to a real user. Contact support'}, status=400)

        submitted = [
            (data.get('answer_1') or '').strip(),
            (data.get('answer_2') or '').strip(),
            (data.get('answer_3') or '').strip(),
        ]
        stored_hashes = [answer_set.answer_1_hash, answer_set.answer_2_hash, answer_set.answer_3_hash]

        all_correct = all(_check_answer(incoming, stored) for incoming, stored in zip(submitted, stored_hashes))
        if not all_correct:
            return JsonResponse(
                {'fieldErrors': {'answer_1': 'One or more answers are incorrect.'}},
                status=400,
            )

        del request.session[USERNAME_RECOVERY_SESSION_KEY]
        return JsonResponse({'success': True, 'username': answer_set.user.username})


# =====================================================================
# Staff signup — OUT OF SCOPE for this task
# =====================================================================

class StaffSignUp(View):
      pass
