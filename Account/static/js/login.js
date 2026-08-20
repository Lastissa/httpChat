/* =========================================================
    page-specific logic for the login form only.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    if (!form) return;

    HttpChat.submitFormAsJson(form, {
        errorElementIds: {
            username: 'login-username-error',
            password: 'login-password-error',
        },
    });
});
