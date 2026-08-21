/* =========================================================
   password_reset_confirm.js
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('password-reset-form');
    if (!form) return;

    HttpChat.submitFormAsJson(form, {
        errorElementIds: {
            password: 'reset-password-error',
            password_confirm: 'reset-password-confirm-error',
        },
        loadingLabel: 'Saving…',
    });
});
