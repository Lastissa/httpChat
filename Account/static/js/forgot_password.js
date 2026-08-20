/* =========================================================
   page-specific logic for the
   forgot-password page's two tabs.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const tabEmail = document.getElementById('tab-email');
    const tabSecurity = document.getElementById('tab-security');
    const panelEmail = document.getElementById('panel-email');
    const panelSecurity = document.getElementById('panel-security');
    if (!tabEmail) return; // not on this page

    /* ---- Tabs: user picks either method upfront, per this
       project's explicit choice, not a sequential fallback. ---- */
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
       (no redirect) — the user's next action happens in their inbox,
       not on this site*/
    const emailForm = document.getElementById('email-reset-form');
    const emailConfirmation = document.getElementById('email-reset-confirmation');
    HttpChat.submitFormAsJson(emailForm, {
        errorElementIds: { email: 'reset-email-error' },
        onSuccess: (data) => {
            emailForm.hidden = true;
            emailConfirmation.textContent = data.message;
            emailConfirmation.hidden = false;
        },
    });

    /* ---- Security-question tab, step 1: look up the account ---- */
    const lookupForm = document.getElementById('security-lookup-form');
    const verifyForm = document.getElementById('security-verify-form');
    const questionsList = document.getElementById('security-verify-questions');

    HttpChat.submitFormAsJson(lookupForm, {
        errorElementIds: { identifier: 'reset-identifier-error' },
        onSuccess: (data) => {
            questionsList.innerHTML = '';
            (data.questions || []).forEach((q) => {
                const li = document.createElement('li');
                li.textContent = q;
                questionsList.appendChild(li);
            });
            lookupForm.hidden = true;
            verifyForm.hidden = false;
            const firstAnswer = document.getElementById('reset-answer-1');
            if (firstAnswer) firstAnswer.focus();
        },
    });

    /* ---- Security-question tab, step 2: verify answers ----
       Default success behaviour (a real redirect to the shared
       "set a new password" page) is exactly what's wanted here, so
       no onSuccess override is needed. */
    HttpChat.submitFormAsJson(verifyForm, {
        errorElementIds: { answer_1: 'security-verify-error' },
    });
});
