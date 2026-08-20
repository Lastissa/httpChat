/* =========================================================
   signup.js — page-specific logic for the signup form only.
   Shared behaviour (password-show toggle, toasts, page loader,
   nav) lives in base_template.js.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signup-form');
    if (!form) return; // not on the signup page

    const usernameInput = document.getElementById('signup-username');
    const usernameCheckBtn = document.getElementById('signup-username-check');
    const usernameStatus = document.getElementById('signup-username-status');
    const emailInput = document.getElementById('signup-email');

    const passwordInput = document.getElementById('signup-password');
    const strengthBars = document.querySelectorAll('#signup-password-strength .password-strength__bar');
    const strengthLabel = document.getElementById('signup-password-strength-label');

    const questionSelect = document.getElementById('signup-secret-question');
    const questionsPreview = document.getElementById('signup-questions-preview');
    const answerInputs = [
        document.getElementById('signup-secret-answer-1'),
        document.getElementById('signup-secret-answer-2'),
        document.getElementById('signup-secret-answer-3'),
    ];

    /* ---- Username availability check ----
       Manual "Check" button (explicit user action) AND a debounced
       check as they type, both hitting the same endpoint. Uses
       {suppressToast: true} because the result is shown inline via
       the .username-status element — a toast on top of that would be
       the redundant double-feedback this project is trying to remove. */
    function checkUsername() {
        const username = usernameInput.value.trim();
        if (username.length < 3) {
            usernameStatus.dataset.state = '';
            usernameStatus.textContent = '';
            return;
        }
        usernameStatus.dataset.state = 'checking';
        usernameStatus.textContent = 'Checking availability…';

        fetch('/username/availability/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': HttpChat.getCsrfToken(form) },
            body: JSON.stringify({ username, email: emailInput.value.trim() }),
            suppressToast: true,
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.available) {
                    usernameStatus.dataset.state = 'available';
                    usernameStatus.textContent = 'Username is available.';
                    HttpChat.setFieldError(usernameInput, document.getElementById('signup-username-error'), '');
                }else if (!data.available && data?.rate_limited){
                    usernameStatus.dataset.state = 'taken';
                    const suggestion = data.suggested_username ? ` Try "${data.suggested_username}"?` : '';
                    usernameStatus.textContent = data.message;
                } else {
                    usernameStatus.dataset.state = 'taken';
                    const suggestion = data.suggested_username ? ` Try "${data.suggested_username}"?` : '';
                    usernameStatus.textContent = `That username is taken.${suggestion}`;
                }
            })
            .catch((e) => {
                console.log(e)
                usernameStatus.dataset.state = 'error';
                usernameStatus.textContent = "Couldn't check right now.";
            });
    }

    usernameCheckBtn.addEventListener('click', checkUsername);
    usernameInput.addEventListener('input', HttpChat.debounce(checkUsername, 500));

    /* ---- Password strength meter ----
       A fast, client-side-only heuristic to give immediate visual
       feedback as the user types. NOT the source of truth , the real
       check is server-side. */
    function scorePassword(value) {
        let score = 0;
        if (value.length >= 8) score += 1;
        if (value.length >= 12) score += 1;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
        if (/\d/.test(value)) score += 1;
        if (/[^A-Za-z0-9]/.test(value)) score += 1;
        return score; // 0-5
    }

    passwordInput.addEventListener('input', () => {
        const value = passwordInput.value;
        const score = scorePassword(value);
        const level = value.length === 0 ? null : score <= 2 ? 'weak' : score <= 3 ? 'medium' : 'strong';

        strengthBars.forEach((bar, i) => {
            bar.classList.remove('is-weak', 'is-medium', 'is-strong');
            const filled = level === 'weak' ? i < 1 : level === 'medium' ? i < 2 : level === 'strong' ? i < 3 : false;
            if (filled) bar.classList.add(`is-${level}`);
        });
        strengthLabel.textContent = value.length === 0 ? '' : { weak: 'Weak password', medium: 'Okay password', strong: 'Strong password' }[level];
    });

    /* ---- Security question set -> show its 3 questions, enable answers ---- */
    questionSelect.addEventListener('change', () => {
        const selectedOption = questionSelect.selectedOptions[0];
        const raw = selectedOption ? selectedOption.dataset.questions : '';
        const questions = (raw || '').split(',').map((q) => q.trim()).filter(Boolean);

        questionsPreview.innerHTML = '';
        questions.forEach((q, i) => {
            const li = document.createElement('li');
            li.textContent = q;
            questionsPreview.appendChild(li);
            if (answerInputs[i]) {
                answerInputs[i].disabled = false;
                answerInputs[i].placeholder = q;
            }
        });
        questionsPreview.hidden = questions.length === 0;
    });

    /* ---- Submit ----
       Hybrid:
        fetch handles validation errors inline (fieldErrors),
        a real browser redirect happens on success. */
    HttpChat.submitFormAsJson(form, {
        errorElementIds: {
            username: 'signup-username-error',
            email: 'signup-email-error',
            password: 'signup-password-error',
            password_confirm: 'signup-password-confirm-error',
            secret_question: 'signup-secret-question-error',
            secret_answer_1: 'signup-secret-answer-1-error',
        },
    });
});
