/* =========================================================
   page-specific logic for the forgot-username page's two
   tabs. Structurally a near-copy of forgot_password.js — see
   that file for the shared reasoning — with one behavioural
   difference: the security-question tab's step 2 reveals the
   username in place instead of redirecting anywhere.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const tabEmail = document.getElementById('tab-email');
    const tabSecurity = document.getElementById('tab-security');
    const panelEmail = document.getElementById('panel-email');
    const panelSecurity = document.getElementById('panel-security');
    if (!tabEmail) return; // not on this page

    /* ---- Tabs: user picks either method upfront ---- */
    function selectTab(tab) {
        const isEmail = tab === 'email';
        tabEmail.setAttribute('aria-selected', String(isEmail));
        tabSecurity.setAttribute('aria-selected', String(!isEmail));
        panelEmail.hidden = !isEmail;
        panelSecurity.hidden = isEmail;
    }
    tabEmail.addEventListener('click', () => selectTab('email'));
    tabSecurity.addEventListener('click', () => selectTab('security'));

    /* ---- Email tab ----
       On success, swap the form for a confirmation message in place
       (no redirect) — same pattern as the password-reset email tab. */
    const emailForm = document.getElementById('email-username-form');
    const emailConfirmation = document.getElementById('email-username-confirmation');
    HttpChat.submitFormAsJson(emailForm, {
        errorElementIds: { email: 'username-recovery-email-error' },
        onSuccess: (data) => {
            emailForm.hidden = true;
            emailConfirmation.textContent = data.message;
            emailConfirmation.hidden = false;
        },
    });

    /* ---- Security-question tab, step 1: look up the account ---- */
    const lookupForm = document.getElementById('username-security-lookup-form');
    const verifyForm = document.getElementById('username-security-verify-form');
    const questionsList = document.getElementById('username-security-verify-questions');

    HttpChat.submitFormAsJson(lookupForm, {
        errorElementIds: { identifier: 'username-recovery-identifier-error' },
        onSuccess: (data) => {
            questionsList.innerHTML = '';
            (data.questions || []).forEach((q) => {
                const li = document.createElement('li');
                li.textContent = q;
                questionsList.appendChild(li);
            });
            lookupForm.hidden = true;
            verifyForm.hidden = false;
            const firstAnswer = document.getElementById('username-recovery-answer-1');
            if (firstAnswer) firstAnswer.focus();
        },
    });

    /* ---- Security-question tab, step 2: verify answers ----
       Reveal the username in place instead of redirecting — this
       IS the destination, not a step on the way to one. */
    const usernameReveal = document.getElementById('username-reveal');
    const usernameRevealValue = document.getElementById('username-reveal-value');
    HttpChat.submitFormAsJson(verifyForm, {
        errorElementIds: { answer_1: 'username-security-verify-error' },
        onSuccess: (data) => {
            verifyForm.hidden = true;
            usernameRevealValue.textContent = data.username;
            usernameReveal.hidden = false;
        },
    });
});
