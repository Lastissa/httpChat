# AI Workflow Log

Every refactor/edit made by an AI tool to this project is logged here,
per AGENT.MD. Newest entries at the top.

---

## 2026-08-21 — Home page UI (Chats/Status/Feed/Video shell) + nav updates

**Scope:** UI only (html/css). No .py, view, url, or migration files touched.

**Files changed:**
- `Account/templates/html/home.html` — rebuilt as a WhatsApp-style
  "Chats" screen (the current/default tab): in-page header with title +
  search field, empty-state chat list (no chat backend exists yet, so
  no fake data — see task notes), a floating "new chat" action, and a
  bottom nav (Chats / Status / Feed / Video). Status, Feed, Video, and
  the new-chat action have no view/URL yet, so they use `href="#"`
  placeholders rather than `{% url %}` (would 500 otherwise). Removed
  the old inline logout button/greeting text, since logout now lives
  in the nav (see nav_home.html below) and the placeholder copy was
  no longer accurate.
- `Account/templates/reusables/nav_home.html` — added "New group",
  "Starred", "Settings" to both the desktop link row and the mobile
  3-dot (kebab) menu, ahead of the existing "Log out". Same `href="#"`
  placeholder reasoning — none of these have a view yet.
- `Account/static/light_css/home.css` (new) — critical/structural CSS
  for the home shell: header, search field, empty state, floating
  action button, and fixed bottom nav (with `env(safe-area-inset-bottom)`
  handling for notched phones). Loaded synchronously, mirroring the
  existing `light_css/auth.css` pattern, because the bottom nav
  reserves real layout space that must be correct on first paint.
- `Account/static/heavy_css/home.css` (new) — non-critical polish
  (shadows, hover/active motion) for the same elements, loaded async
  after first paint, mirroring `heavy_css/auth.css`.
- `Account/static/base_template_light.css` — **fixed a pre-existing
  bug**, unrelated to this task: the file was two copies of the same
  stylesheet corrupted together (a truncated first copy ending mid-rule,
  a complete second copy, then a redundant tail from the first copy),
  1173 lines total with an unbalanced brace. Rebuilt to the single
  complete, valid copy (623 lines, brace-balanced, verified by
  rendering every page's template). This governs light/dark theme
  tokens, the persistent nav, buttons, forms, etc. site-wide.

**Verification done:** rendered `home.html`, `login.html`, `signup.html`,
`forgot_password.html`, `landing.html` through Django's real template
engine (with the project's actual `ROOT_URLCONF`/context processors) to
confirm nothing broke; checked all touched/added CSS files for balanced
braces.

**Found but NOT fixed (out of scope for this task, flagged for you):**
`signup.html` throws `ValueError: Need 2 values to unpack in for loop;
got 90` on its `{% for index, question_set in security_questions %}`
loop (line 131) when rendered without a real request/session providing
`security_questions` in the right shape. Pre-existing, not touched —
would need a `views.py` fix, which is outside this task's UI-only scope.

**Decisions made per your answers (not guessed):**
- Cleaned up the corrupted `base_template_light.css` rather than leaving it.
- Bottom nav is a static, non-JS-switching shell — Status/Feed/Video
  are placeholder links only, no client-side tab logic added.
- Chat list ships as an empty-state skeleton, no hardcoded mock chats.
