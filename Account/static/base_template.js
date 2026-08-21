/* =========================================================
   base_template.js
   Shared, site-wide behaviour. Page-specific logic (signup,
   login, forgot-password field validation etc.) stays in its
   own file under static/js/ 
   ========================================================= */

const HttpChat = (() => {

    /* =========================================================
       1. Toasts
       ---------------------------------------------------------
       Client-side ONLY — created exclusively in response to a
       fetch() call (see toastFromJsonResponse). Django's
       server-rendered messages are a completely separate system
       (rendered once in base_template.html)
       Capped at MAX_VISIBLE_TOASTS: once that many are showing,
       adding a new one removes the OLDEST still-visible toast
       first, so rapid repeated actions (e.g. mashing a button)
       can not stack the queue without limit and break the
       layout.
       ========================================================= */
    const MAX_VISIBLE_TOASTS = 3;
    const activeToasts = []; // oldest first

    function getToastRegion() {
        let region = document.getElementById('toast-region');
        if (!region) {
            region = document.createElement('div');
            region.id = 'toast-region';
            region.className = 'toast-region';
            region.setAttribute('role', 'status');
            region.setAttribute('aria-live', 'polite');
            document.body.appendChild(region);
        }
        return region;
    }

    function removeToast(toast) {
        const idx = activeToasts.indexOf(toast);
        if (idx !== -1) activeToasts.splice(idx, 1);
        if (toast && toast.isConnected) toast.remove();
    }

    /** Show a small toast notification. type: 'default' | 'success' | 'error' */
    function showToast(message, type = 'default', duration = 3500) {
        if (!message) return;
        const region = getToastRegion();

        // Enforce the visible cap BEFORE adding the new one, so we
        // never briefly show 4+ at once.
        while (activeToasts.length >= MAX_VISIBLE_TOASTS) {
            removeToast(activeToasts[0]);
        }

        const toast = document.createElement('div');
        toast.className = `toast${type !== 'default' ? ' toast-' + type : ''}`;
        toast.textContent = message;
        region.appendChild(toast);
        activeToasts.push(toast);

        window.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.2s ease';
            window.setTimeout(() => removeToast(toast), 200);
        }, duration);
    }

    /* ---- Fallback copy when a JSON response has no "message" key ----
       Keyed by exact status first, then leading digit ("4xx"/"5xx")
       as a catch-all so we don't need an entry per status code. */
    const STATUS_FALLBACKS = {
        200: 'Success!',
        201: 'Created successfully.',
        400: 'Invalid request, please check your input.',
        401: 'You need to log in to continue.',
        403: "permission denied..",
        404: 'Not found.',
        409: 'That already exists.',
        422: 'Some fields need your attention.',
        429: 'Too many requests, avoid spam.',
        500: 'Something went wrong on our end.',
        502: 'Service temporarily unavailable.',
        503: 'Service temporarily unavailable.',
        504: 'The server took too long to respond.',
        '2xx': 'Success!',
        '4xx': 'Something went wrong.',
        '5xx': 'Server error — please try again later.'
    };

    function fallbackMessageForStatus(status) {
        if (STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];
        return STATUS_FALLBACKS[`${Math.floor(status / 100)}xx`] || null;
    }

    function toastFromJsonResponse(response) {
        if (!response || response.status === 204) return; // no body to read
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;

        // clone() so the app code that actually called fetch() can still
        // read the original response body itself.
        response.clone().json()
            .then((data) => {
                // "fieldErrors" responses (signup/login validation) are
                // rendered as INLINE field errors by the page's own JS,
                // not as a toast
                if (data && typeof data === 'object' && data.fieldErrors) return;

                const message = data && typeof data === 'object' ? data.message : null;
                const type = response.ok ? 'success' : 'error';
                showToast(message || fallbackMessageForStatus(response.status), type);
            })
            .catch(() => { /* body wasn't valid JSON despite the header — ignore */ });
    }

    /**
     * Patches window.fetch so ANY JSON response, anywhere in the app,
     * automatically surfaces its "message" (or a status-based fallback)
     * as a toast with no per-call code required.
     *
     * Escape hatch: pass `{ suppressToast: true }` in the fetch init
     * object for calls that should stay silent (e.g. background
     * polling, or a call whose page-specific JS already renders its
     * own inline errors/confirmation).
     */
    function initFetchToastInterceptor() {
        if (typeof window.fetch !== 'function' || window.fetch.__httpchatPatched) return;
        const nativeFetch = window.fetch.bind(window);

        const patched = function (input, init) {
            return nativeFetch(input, init).then((response) => {
                if (!init || !init.suppressToast) {
                    toastFromJsonResponse(response);
                }
                return response;
            });
        };
        patched.__httpchatPatched = true;
        window.fetch = patched;
    }

    /* =========================================================
       2. Theme toggle
       ---------------------------------------------------------
       There are now TWO toggle buttons in the DOM at once
       (#theme-toggle for desktop, #theme-toggle-mobile inside the
       3-dot menu) — both are kept in sync on every change.
       ========================================================= */
    const THEME_COOKIE_NAME = 'theme';
    const THEME_COOKIE_MAX_AGE_DAYS = 365;

    function setThemeCookie(theme) {
        const maxAge = THEME_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60; // seconds
        // SameSite=Lax + no Secure flag so it also works over plain
        // http:// in local development (see project_base_url).
        document.cookie = `${THEME_COOKIE_NAME}=${theme}; max-age=${maxAge}; path=/; SameSite=Lax`;
    }

    function getThemeToggleButtons() {
        return [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-mobile')]
            .filter(Boolean);
    }

    function syncThemeToggleButtons(theme) {
        const isDark = theme === 'dark';
        getThemeToggleButtons().forEach((btn) => {
            btn.setAttribute('aria-pressed', String(isDark));
            btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        });
    }

    function initThemeToggle() {
        const buttons = getThemeToggleButtons();
        if (buttons.length === 0) return;

        // Reflect whatever theme the server already rendered.
        syncThemeToggleButtons(document.documentElement.getAttribute('data-theme') || 'light');

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                setThemeCookie(next);
                syncThemeToggleButtons(next);
            });
        });
    }

    /* =========================================================
       3. Nav bar — mobile 3-dot (kebab) dropdown
       ---------------------------------------------------------
       Replaces the old hamburger slide-down panel. Only 3 items
       live in here (Login, Sign Up, theme toggle), so a small
       anchored dropdown is simpler than a full mobile panel —
       avoids over-engineering a menu the content doesn't need.
       ========================================================= */
    function initNavKebab() {
        const wrapper = document.getElementById('nav-kebab');
        const btn = document.getElementById('nav-kebab-btn');
        const menu = document.getElementById('nav-kebab-menu');
        if (!wrapper || !btn || !menu) return;

        const closeMenu = () => {
            wrapper.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(isOpen));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });
        document.addEventListener('click', (e) => {
            if (wrapper.classList.contains('is-open') && !wrapper.contains(e.target)) closeMenu();
        });
        // Tapping a real link inside the menu should close it (the
        // page-leave overlay + navigation take over from here).
        menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    }

    /* =========================================================
       4. Form field helpers
       ========================================================= */

    /** Show/clear an inline error message under a field. */
    function setFieldError(fieldEl, errorEl, message) {
        if (message) {
            fieldEl.classList.add('has-error');
            fieldEl.setAttribute('aria-invalid', 'true');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.classList.add('is-visible');
            }
        } else {
            fieldEl.classList.remove('has-error');
            fieldEl.removeAttribute('aria-invalid');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('is-visible');
            }
        }
    }

    /**
     * Wires up any [data-toggle-password] button to flip the type of
     * the input it targets (via [data-target="#inputId"]) between
     * password/text. Shows an eye / eye-slash ICON now
     * "Show"/"Hide" label — see .input-group-btn in
     * base_template_light.css, which swaps which <svg> is visible
     * purely off the button's aria-pressed state.
     */
    function initPasswordToggles(root = document) {
        root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetSelector = btn.getAttribute('data-target');
                const input = document.querySelector(targetSelector);
                if (!input) return;
                const showing = input.type === 'text';
                input.type = showing ? 'password' : 'text';
                btn.setAttribute('aria-pressed', String(!showing));
                btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
            });
        });
    }

    /* =========================================================
       5. Page loader — initial load + page-leave transition
       ---------------------------------------------------------
       #page-loader (page_open.html): shown on first paint,
       hidden once the heavy stylesheet(s) have loaded AND
       DOMContentLoaded has fired, or after
       PAGE_LOADER_HARD_TIMEOUT_MS — whichever is first, so a
       slow network can never leave someone stuck on it.

       #page-leave-loader (page_leave.html): shown the instant
       the user clicks an internal link (or a script calls
       HttpChat.leavePage(url)), so the destination's own loader
       picks up seamlessly instead of a blank moment on the old
       page while the browser fetches the next one.
       ========================================================= */
    const PAGE_LOADER_HARD_TIMEOUT_MS = 8000;

    function hideEl(el) {
        if (!el || el.hidden) return;
        el.classList.add('is-fading');
        window.setTimeout(() => { el.hidden = true; el.classList.remove('is-fading'); }, 250);
    }

    function initInitialPageLoader() {
        const loader = document.getElementById('page-loader');
        if (!loader) return;

        let domReady = false;
        let heavyCssReady = false;
        let hidden = false;

        const maybeHide = () => {
            if (hidden || !domReady || !heavyCssReady) return;
            hidden = true;
            hideEl(loader);
        };

        // Heavy stylesheets use the media="print" -> onload="this.media='all'"
        // trick (see base_template.html) to load without blocking render.
        // Their onload has already fired by the time this runs if the
        // browser cached them, so we check readyState-equivalent by
        // just listening for load AND falling back to the hard timeout.
        const heavyLinks = document.querySelectorAll('link[rel="stylesheet"][media="print"]');
        let pending = heavyLinks.length;
        if (pending === 0) {
            heavyCssReady = true;
        } else {
            heavyLinks.forEach((link) => {
                link.addEventListener('load', () => {
                    pending -= 1;
                    if (pending <= 0) { heavyCssReady = true; maybeHide(); }
                });
            });
        }

        document.addEventListener('DOMContentLoaded', () => { domReady = true; maybeHide(); });

        // Hard stop — never let the loader outlive this, regardless of
        // what the network is doing.
        window.setTimeout(() => {
            if (hidden) return;
            hidden = true;
            hideEl(loader);
        }, PAGE_LOADER_HARD_TIMEOUT_MS);
    }

    function showPageLeaveOverlay() {
        const overlay = document.getElementById('page-leave-loader');
        if (!overlay) return;
        overlay.hidden = false;
        overlay.classList.add('page-loader--leaving');
    }

    /**
     * Navigate to `url` after briefly showing the page-leave overlay,
     * so there's no blank moment between "form succeeded" and the
     * next page's own loader taking over. Small delay is just enough
     * for the overlay to paint before navigation starts.
     */
    function leavePage(url) {
        showPageLeaveOverlay();
        window.setTimeout(() => { window.location.href = url; }, 120);
    }

    function initPageLeaveOnLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            // Skip: same-page anchors, new-tab links, decoys already
            // handled elsewhere, and anything explicitly opted out.
            if (!href || href.startsWith('#')) return;
            if (link.target && link.target !== '_self') return;
            if (link.hasAttribute('data-no-leave-transition')) return;
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
            showPageLeaveOverlay();
        });
    }

    /**
     * KNOWN-ISSUE FIX: if a user navigates away and then hits the
     * browser BACK button, some browsers restore the page from the
     * back/forward cache (bfcache) instead of re-running page-load
     * JS. Without this, the page-leave overlay set right before they
     * left would still be sitting there, hidden=false, on the
     * "new" (restored) page. `pageshow` fires on every page view,
     * including bfcache restores, and `event.persisted` is true only
     * for those restores — so this only does anything on exactly the
     * case that was broken.
     */
    function initBackForwardCacheFix() {
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) return;
            const leaveOverlay = document.getElementById('page-leave-loader');
            if (leaveOverlay) {
                leaveOverlay.hidden = true;
                leaveOverlay.classList.remove('page-loader--leaving');
            }
            const openLoader = document.getElementById('page-loader');
            if (openLoader) {
                openLoader.hidden = true;
                openLoader.classList.remove('is-fading');
            }
        });
    }

    /* =========================================================
       6. Shared AJAX form helper
       ---------------------------------------------------------
       Used by signup.js / login.js / forgot_password.js. Submits
       a form via fetch as JSON-encoded field/value pairs. The
       server is expected to answer one of two shapes:

         Validation problem (still 200/4xx, JSON):
           { "fieldErrors": { "email": "Enter a valid email address." } }
         Success:
           { "success": true, "redirect": "/some/url/" }

       On fieldErrors: each field's message is written inline via
       setFieldError — no toast (see fieldErrors check in
       toastFromJsonResponse above)
       On success: HttpChat.leavePage(data.redirect) — a REAL
       browser navigation (not a DOM swap), so the destination is
       a normal server-rendered page with its own messages/state.
       ========================================================= */
    function getCsrfToken(form) {
        const input = form.querySelector('input[name="csrfmiddlewaretoken"]');
        return input ? input.value : '';
    }

    /**
     * Puts a submit button into (or out of) an in-progress state: a
     * spinner, `aria-busy`, and (optionally) a swapped label — e.g.
     * "Log in" -> "Logging in…". This is the ONLY feedback a user gets
     * that their click registered; `disabled` + the OS not-allowed
     * cursor alone is invisible on mobile (no cursor) and easy to miss
     * on desktop (only shows while actively hovering the button).
     */
    function setButtonLoading(btn, isLoading, loadingLabel) {
        if (!btn) return;

        if (isLoading) {
            let label = btn.querySelector('.btn__label');
            if (!label) {
                label = document.createElement('span');
                label.className = 'btn__label';
                label.textContent = btn.textContent.trim();
                btn.textContent = '';
                btn.appendChild(label);
            }
            if (!btn.dataset.originalLabel) btn.dataset.originalLabel = label.textContent;
            if (!btn.querySelector('.btn__spinner')) {
                const spinner = document.createElement('span');
                spinner.className = 'btn__spinner';
                spinner.setAttribute('aria-hidden', 'true');
                btn.insertBefore(spinner, label);
            }
            if (loadingLabel) label.textContent = loadingLabel;

            btn.disabled = true;
            btn.classList.add('is-loading');
            btn.setAttribute('aria-busy', 'true');
        } else {
            btn.disabled = false;
            btn.classList.remove('is-loading');
            btn.removeAttribute('aria-busy');

            const spinner = btn.querySelector('.btn__spinner');
            if (spinner) spinner.remove();
            const label = btn.querySelector('.btn__label');
            if (label && btn.dataset.originalLabel) label.textContent = btn.dataset.originalLabel;
            delete btn.dataset.originalLabel;
        }
    }

    /**
     * @param {HTMLFormElement} form
     * @param {Object} opts
     * @param {Object.<string,string>} opts.errorElementIds - maps a
     *   form field name to the id of its <span class="field-error">.
     * @param {function} [opts.onSuccess] - called with the parsed
     *   response body instead of the default leavePage() redirect,
     *   if provided.
     * @param {function} [opts.beforeSubmit] - return false to abort.
     */
    function submitFormAsJson(form, opts) {
        const { errorElementIds, onSuccess, beforeSubmit, loadingLabel } = opts;

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (typeof beforeSubmit === 'function' && beforeSubmit(form) === false) return;

            // Clear any previously-shown errors before this attempt.
            Object.entries(errorElementIds).forEach(([fieldName, errorId]) => {
                const input = form.querySelector(`[name="${fieldName}"]`);
                const errorEl = document.getElementById(errorId);
                if (input && errorEl) setFieldError(input, errorEl, '');
            });

            const submitBtn = form.querySelector('[type="submit"]');
            setButtonLoading(submitBtn, true, loadingLabel);

            // Set when we hand off to a real page navigation (leavePage),
            // so .finally() below knows to leave the button in its
            // loading/disabled state through the redirect instead of
            // briefly re-enabling it (and inviting a second click) in
            // the ~120ms window before the browser actually navigates.
            let navigatingAway = false;

            const payload = {};
            new FormData(form).forEach((value, key) => { payload[key] = value; });

            fetch(form.action, {
                method: form.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(form),
                },
                body: JSON.stringify(payload),
                suppressToast: true, // this helper owns its own feedback
            })
                .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
                .then(({ ok, data }) => {
                    if (data && data.fieldErrors) {
                        Object.entries(data.fieldErrors).forEach(([fieldName, message]) => {
                            const errorId = errorElementIds[fieldName];
                            const input = form.querySelector(`[name="${fieldName}"]`);
                            const errorEl = errorId ? document.getElementById(errorId) : null;
                            if (input) setFieldError(input, errorEl, message);
                        });
                        const firstInvalid = form.querySelector('.field-input.has-error, select.has-error');
                        if (firstInvalid) firstInvalid.focus();
                        return;
                    }

                    if (ok && data && data.success) {
                        if (typeof onSuccess === 'function') {
                            onSuccess(data);
                        } else if (data.redirect) {
                            navigatingAway = true;
                            leavePage(data.redirect);
                        }
                        return;
                    }

                    // Anything else (server error, unexpected shape) —
                    // fall back to a toast so the user isn't left with
                    // silence.
                    showToast((data && data.message) || fallbackMessageForStatus(response ? response.status : 500), 'error');
                })
                .catch(() => {
                    showToast('Could not reach the server, please try again.', 'error');
                })
                .finally(() => {
                    if (!navigatingAway) setButtonLoading(submitBtn, false);
                });
        });
    }

    /* =========================================================
       7. Misc utilities
       ========================================================= */

    /** Standard debounce for input-triggered async calls (e.g. username checks). */
    function debounce(fn, wait = 350) {
        let timer = null;
        return (...args) => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn(...args), wait);
        };
    }

    /* =========================================================
       Init
       ========================================================= */

    // Patch fetch as early as possible (not gated on DOMContentLoaded)
    // so it also covers any script that fires before the DOM is ready.
    initFetchToastInterceptor();
    // Same reasoning: the initial loader needs to start timing itself
    // immediately, not wait for DOMContentLoaded.
    initInitialPageLoader();
    initBackForwardCacheFix();

    function init() {
        initPasswordToggles();
        initThemeToggle();
        initNavKebab();
        initPageLeaveOnLinks();
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        showToast,
        setFieldError,
        initPasswordToggles,
        debounce,
        leavePage,
        submitFormAsJson,
        getCsrfToken,
    };
})();
