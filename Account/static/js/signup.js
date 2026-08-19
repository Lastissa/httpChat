/* =========================================================
   signup.js
   Page-specific behaviour for the sign-up form only:
     1. Security-question set preview + per-answer-box labelling
        (split the chosen set's combined string into its 3
        individual questions, enable/label the 3 answer boxes).
     2. Manual, button-triggered username availability check.
     3. Full client-side validation on submit.

   Kept out of base_template.js because nothing else on the site
   uses these features yet — see AGENT.MD's "no bloat, every line
   has a task" rule.
   ========================================================= */

(function () {
    'use strict';

    /* ---------------------------------------------------------------
       1. Security question set preview + answer-box wiring
       ---------------------------------------------------------------
       Each <option> value is a backend-provided string bundling 3
       questions, comma-separated, e.g.:
         "What city were you born in?, What was your first pet's name?, What is your favourite food?"
       We split on "," and trim so the user can see exactly which 3
       questions they're committing to answer. Each question is also
       used as the placeholder for its matching answer box, and the
       3 boxes are only enabled once a set has been chosen.
       --------------------------------------------------------------- */
    function initSecurityQuestionPreview() {
        const select = document.getElementById('id_secret_question');
        const preview = document.getElementById('security-questions-preview');
        const answerInputs = [
            document.getElementById('id_secret_answer_1'),
            document.getElementById('id_secret_answer_2'),
            document.getElementById('id_secret_answer_3'),
        ];
        if (!select || !preview || answerInputs.some((el) => !el)) return;

        select.addEventListener('change', () => {
            const raw = select.value;
            const questions = raw
                ? raw.split(',').map((q) => q.trim()).filter(Boolean)
                : [];

            if (questions.length === 0) {
                preview.hidden = true;
                preview.innerHTML = '';
                answerInputs.forEach((input, i) => {
                    input.disabled = true;
                    input.value = '';
                    input.placeholder = `Answer ${i + 1}`;
                });
                return;
            }

            preview.innerHTML = questions
                .map((q) => `<li>${escapeHtml(q)}</li>`)
                .join('');
            preview.hidden = false;

            answerInputs.forEach((input, i) => {
                input.disabled = false;
                input.placeholder = questions[i] || `Answer ${i + 1}`;
            });

            clearFieldError('answer-error', answerInputs);
        });
    }

    /** Minimal HTML-escaping so backend-supplied question text can't
        break markup if it ever contains "<" or "&". */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ---------------------------------------------------------------
       2. Username availability check
       ---------------------------------------------------------------
       Manual, button-triggered (not on every keystroke) so we don't
       hammer the backend. Sends the typed username + email so the
       backend can suggest an alternative if that username is taken.

       BACKEND CONTRACT (placeholder — endpoint not implemented yet;
       logged in AI_WORKFLOW.MD for the backend owner to wire up):
         POST USERNAME_CHECK_ENDPOINT
         body:      { "username": "<value>", "email": "<value or omitted>" }
         response:  { "available": true }
                 or { "available": false, "suggested_username": "..." }
       Any other shape still degrades gracefully below.

       Email is OPTIONAL: it's only used to make a more personalized
       suggested_username if the typed username is taken, so we still
       fire the request without it — just with the "email" key left out
       of the body entirely rather than sent as "".
       --------------------------------------------------------------- */
    const USERNAME_CHECK_ENDPOINT = "/username/availability/"; // TODO(backend): route not wired up yet

    function initUsernameAvailabilityCheck() {
        const btn = document.getElementById('check-username-btn');
        const usernameInput = document.getElementById('id_username');
        const emailInput = document.getElementById('id_email');
        const status = document.getElementById('username-status');
        if (!btn || !usernameInput || !emailInput || !status) return;

        function setStatus(state, message) {
            status.dataset.state = state;
            // Clear any existing suggestion buttons
            const existingBtn = status.querySelector('.username-status__use-suggestion');
            if (existingBtn) existingBtn.remove();
            status.textContent = message;
        }

        function getCsrfToken() {
            const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
            return input ? input.value : '';
        }

        btn.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();

            if (!username) {
                setStatus('taken', 'Enter a username first.');
                usernameInput.focus();
                return;
            }

            const payload = email ? { username, email } : { username };

            btn.disabled = true;
            setStatus('checking', 'Checking availability…');

            fetch(USERNAME_CHECK_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(payload),
            })
            .then(response => response.json())
            .then(data => {
                // Handle the response - all 200 responses come here
                if (data.available) {
                    setStatus('available', '✓ Username is available.');
                    return;
                }

                // Username is taken
                const suggestion = data.suggested_username;
                const message = data.message || 'That username is already taken.';

                setStatus('taken', suggestion ? `${message} ` : message);

                if (suggestion) {
                    appendUseSuggestionButton(status, suggestion, usernameInput, setStatus);
                }
            })
            .catch(() => {
                setStatus('error', 'Could not reach the server, try again.');
            })
            .finally(() => {
                btn.disabled = false;
            });
        });

        usernameInput.addEventListener('input', () => {
            // Clear status when user types
            const existingBtn = status.querySelector('.username-status__use-suggestion');
            if (existingBtn) existingBtn.remove();
            status.dataset.state = '';
            status.textContent = '';
        });
    }

    /** Adds a small inline button letting the user adopt the backend's
        suggested username with one click instead of retyping it. */
    function appendUseSuggestionButton(statusEl, suggestion, usernameInput, setStatus) {
        const existingBtn = statusEl.querySelector('.username-status__use-suggestion');
        if (existingBtn) existingBtn.remove();

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'username-status__use-suggestion btn btn-sm btn-outline-primary';
        useBtn.textContent = `Use "${suggestion}" instead`;
        useBtn.addEventListener('click', () => {
            usernameInput.value = suggestion;
            usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
            usernameInput.focus();
            setStatus('available', `✓ Using "${suggestion}" - username is available`);
        });
        statusEl.appendChild(useBtn);
    }

    /* ---------------------------------------------------------------
       3. Submit-time validation
       ---------------------------------------------------------------
       novalidate is set on the <form>, so nothing stops a bad
       submission unless we check it ourselves. This mirrors the
       server-side rules (email format, username length, password
       length + match, a security-question set picked, all 3 answers
       filled) and blocks submission + shows inline errors otherwise.
       --------------------------------------------------------------- */
    function initSubmitValidation() {
        const form = document.getElementById('signup-form');
        if (!form) return;

        const emailInput = document.getElementById('id_email');
        const usernameInput = document.getElementById('id_username');
        const passwordInput = document.getElementById('id_password');
        const confirmInput = document.getElementById('id_password_confirm');
        const questionSelect = document.getElementById('id_secret_question');
        const answerInputs = [
            document.getElementById('id_secret_answer_1'),
            document.getElementById('id_secret_answer_2'),
            document.getElementById('id_secret_answer_3'),
        ];
        const errorSummary = document.getElementById('signup-error-summary');

        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        form.addEventListener('submit', (event) => {
            const problems = [];

            // Email
            const email = emailInput.value.trim();
            if (!email) {
                problems.push(setFieldError(emailInput, 'email-error', 'Email is required.'));
            } else if (!EMAIL_RE.test(email)) {
                problems.push(setFieldError(emailInput, 'email-error', 'Enter a valid email address.'));
            } else {
                clearFieldError('email-error', [emailInput]);
            }

            // Username
            const username = usernameInput.value.trim();
            if (!username) {
                problems.push(setFieldError(usernameInput, 'username-error', 'Username is required.'));
            } else if (username.length < 3 || username.length > 100) {
                problems.push(setFieldError(usernameInput, 'username-error', 'Username must be 3–100 characters.'));
            } else {
                clearFieldError('username-error', [usernameInput]);
            }

            // Password
            const password = passwordInput.value;
            if (!password) {
                problems.push(setFieldError(passwordInput, 'password-error', 'Password is required.'));
            } else if (password.length < 8) {
                problems.push(setFieldError(passwordInput, 'password-error', 'Password must be at least 8 characters.'));
            } else {
                clearFieldError('password-error', [passwordInput]);
            }

            // Confirm password
            const confirm = confirmInput.value;
            if (!confirm) {
                problems.push(setFieldError(confirmInput, 'confirm-error', 'Please confirm your password.'));
            } else if (confirm !== password) {
                problems.push(setFieldError(confirmInput, 'confirm-error', 'Passwords do not match.'));
            } else {
                clearFieldError('confirm-error', [confirmInput]);
            }

            // Security question set
            if (!questionSelect.value) {
                problems.push(setFieldError(questionSelect, 'secret-question-error', 'Choose a set of security questions.'));
            } else {
                clearFieldError('secret-question-error', [questionSelect]);
            }

            // Security answers — only meaningful once a set is chosen;
            // otherwise the boxes are disabled and shouldn't block submit.
            if (questionSelect.value) {
                const emptyAnswer = answerInputs.some((input) => !input.value.trim());
                if (emptyAnswer) {
                    problems.push(setFieldError(answerInputs[0], 'answer-error', 'Answer all 3 security questions.', answerInputs));
                } else {
                    clearFieldError('answer-error', answerInputs);
                }
            }

            if (problems.length > 0) {
                event.preventDefault();
                if (errorSummary) {
                    errorSummary.hidden = false;
                    errorSummary.textContent = `Please fix ${problems.length} issue${problems.length > 1 ? 's' : ''} before submitting.`;
                }
                // Focus the first invalid field for a11y / speed.
                const firstInvalid = form.querySelector('.field-input.has-error');
                if (firstInvalid) firstInvalid.focus();
            } else if (errorSummary) {
                errorSummary.hidden = true;
                errorSummary.textContent = '';
            }
        });

        // Clear a field's error as soon as the user starts fixing it.
        [emailInput, usernameInput, passwordInput, confirmInput, questionSelect, ...answerInputs].forEach((el) => {
            if (!el) return;
            el.addEventListener('input', () => clearFieldErrorForInput(el));
            el.addEventListener('change', () => clearFieldErrorForInput(el));
        });
    }

    /** Marks an input (or group of inputs) invalid and shows the
        message in its <span class="field-error">. Returns the message
        so callers can just push the return value onto a problems list. */
    function setFieldError(input, errorId, message, groupInputs) {
        const errorEl = document.getElementById(errorId);
        (groupInputs || [input]).forEach((el) => el.classList.add('has-error'));
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('is-visible');
        }
        return message;
    }

    function clearFieldError(errorId, inputs) {
        const errorEl = document.getElementById(errorId);
        (inputs || []).forEach((el) => el && el.classList.remove('has-error'));
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('is-visible');
        }
    }

    /** Maps a single input back to its error span id so the generic
        "clear on input" listener works without a lookup table per field. */
    function clearFieldErrorForInput(input) {
        const idToError = {
            id_email: 'email-error',
            id_username: 'username-error',
            id_password: 'password-error',
            id_password_confirm: 'confirm-error',
            id_secret_question: 'secret-question-error',
            id_secret_answer_1: 'answer-error',
            id_secret_answer_2: 'answer-error',
            id_secret_answer_3: 'answer-error',
        };
        const errorId = idToError[input.id];
        if (!errorId) return;

        const groupInputs = errorId === 'answer-error'
            ? [
                document.getElementById('id_secret_answer_1'),
                document.getElementById('id_secret_answer_2'),
                document.getElementById('id_secret_answer_3'),
            ]
            : [input];

        // Only clear once the field is actually fixed, not on every keystroke.
        if (errorId === 'confirm-error' && input.id === 'id_password_confirm') {
            const password = document.getElementById('id_password');
            if (input.value && password && input.value !== password.value) return;
        }
        if (errorId === 'answer-error') {
            if (groupInputs.some((el) => !el.value.trim())) return;
        }

        clearFieldError(errorId, groupInputs);
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSecurityQuestionPreview();
        initUsernameAvailabilityCheck();
        initSubmitValidation();
    });
})();