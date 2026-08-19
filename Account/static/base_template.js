/* =========================================================
   base_template.js
   ========================================================= */

const HttpChat = (() => {

    /* =========================================================
       1. Toasts
       ========================================================= */

    /**
     * The toast region is pre-rendered (empty) in base_template.html
     * so assistive tech registers the aria-live region on first paint.
     * Falling back to creating it here keeps this file safe to reuse
     * even if a page's markup is missing it for some reason.
     */
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

    /** Show a small toast notification. type: 'default' | 'success' | 'error' */
    function showToast(message, type = 'default', duration = 3500) {
        if (!message) return;
        const region = getToastRegion();
        const toast = document.createElement('div');
        toast.className = `toast${type !== 'default' ? ' toast-' + type : ''}`;
        toast.textContent = message;
        region.appendChild(toast);

        window.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.2s ease';
            window.setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    /* ---- Fallback copy when a JSON response has no "message" key ----
       Keyed by exact status first, then by the leading digit ("4xx" /
       "5xx") as a catch-all so we don't need an entry for every single
       status code the backend might ever return. */
    const STATUS_FALLBACKS = {
        200: 'Success!',
        201: 'Created successfully.',
        400: 'Invalid request — please check your input.',
        401: 'You need to log in to continue.',
        403: "You don't have permission to do that.",
        404: 'Not found.',
        409: 'That already exists.',
        422: 'Some fields need your attention.',
        429: 'Too many requests, please slow down.',
        500: 'Something went wrong on our end.',
        502: 'Service temporarily unavailable.',
        503: 'Service temporarily unavailable.',
        504: 'The server took too long to respond.',
        '2xx': 'Success!',
        '4xx': 'Something went wrong with that request.',
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
     * polling). This is the one deliberate extra branch in this file,
     * kept because a debounced live-check like the signup username
     * lookup would otherwise pop a toast on every keystroke.
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
       ========================================================= */

    const THEME_COOKIE_NAME = 'theme';
    const THEME_COOKIE_MAX_AGE_DAYS = 365;

    function setThemeCookie(theme) {
        const maxAge = THEME_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60; // seconds
        // SameSite=Lax + no Secure flag so it also works over plain
        // http:// in local development (see project_base_url).
        document.cookie = `${THEME_COOKIE_NAME}=${theme}; max-age=${maxAge}; path=/; SameSite=Lax`;
    }

    function syncThemeToggleButton(theme) {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const isDark = theme === 'dark';
        btn.setAttribute('aria-pressed', String(isDark));
        btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }

    function initThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        // Reflect whatever theme the server already rendered.
        syncThemeToggleButton(document.documentElement.getAttribute('data-theme') || 'light');

        btn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            setThemeCookie(next);
            syncThemeToggleButton(next);
        });
    }

    /* =========================================================
       3. Nav bar — mobile hamburger + decoy links
       ========================================================= */

    function initNavToggle() {
        const nav = document.querySelector('.site-nav');
        const toggleBtn = document.getElementById('nav-toggle');
        if (!nav || !toggleBtn) return;

        const closeMenu = () => {
            nav.classList.remove('is-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
        };

        toggleBtn.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggleBtn.setAttribute('aria-expanded', String(isOpen));
        });

        // Close on Escape and on outside click — small additions that
        // meaningfully improve mobile UX for very little code.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('is-open') && !nav.contains(e.target)) closeMenu();
        });
        // Tapping a real link should also collapse the mobile menu.
        nav.querySelectorAll('.site-nav__link:not([data-decoy])').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });
    }

    /**
     * Links marked [data-decoy] (e.g. "Login" before that page exists)
     * don't navigate anywhere; clicking one tells the user why via a
     * toast instead of silently doing nothing.
     */
    function initDecoyLinks() {
        document.addEventListener('click', (e) => {
            const decoy = e.target.closest('[data-decoy]');
            if (!decoy) return;
            e.preventDefault();
            showToast('This is coming soon!', 'default', 2200);
        });
    }

    /* =========================================================
       4. Form field helpers
       ========================================================= */

    /** Show/clear an inline error message under a field. */
    function setFieldError(fieldEl, errorEl, message) {
        if (message) {
            fieldEl.classList.add('has-error');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.classList.add('is-visible');
            }
        } else {
            fieldEl.classList.remove('has-error');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('is-visible');
            }
        }
    }

    /**
     * Wires up any [data-toggle-password] button to flip the type of the
     * input it targets (via [data-target="#inputId"]) between password/text.
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
                btn.textContent = showing ? 'Show' : 'Hide';
            });
        });
    }

    /* =========================================================
       5. Misc utilities
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

    function init() {
        initPasswordToggles();
        initThemeToggle();
        initNavToggle();
        initDecoyLinks();
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        showToast,
        setFieldError,
        initPasswordToggles,
        debounce
    };
})();
