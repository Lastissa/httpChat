# AI Workflow Log

## 2026-08-19 — Signup page: security questions, username check, logo fix, global messages

**Scope honoured:** UI only (HTML/CSS/JS). No Python files, migrations, or
URLs were touched, per your instruction to keep this pass frontend-only and
wire the backend yourself.

### Files changed
- `Account/templates/reusables/base_template.html`
- `Account/templates/html/signup.html`
- `Account/static/css/signup.css`
- `Account/static/base_template.css`
- `Account/static/js/signup.js` (new file)

### 1. Global Django messages display
Moved the `{% if messages %}` loop out of `signup.html` and into
`base_template.html`, right below the nav. Every page that extends the base
template now shows Django messages automatically — no per-page markup
needed. Wrapped in `.site-messages.container` for consistent page-width
alignment; a `.site-messages{ padding-top }` rule was added to
`base_template.css`.

### 2. Security questions — 3 questions per set
Replaced the old single-question dropdown ("first pet" / "birth city" /
custom, etc.) with a dropdown of **question sets**, sourced from a
`security_questions` context variable you'll provide from the view: a list
of strings, each string bundling 3 questions comma-separated, e.g.
`"What city were you born in?, What was your first pet's name?, What is your favourite food?"`.

- The `<select>` renders one `<option>` per set (`{% for question_set in security_questions %}`), with the full comma-separated string as the option's `value` (so it posts as-is to `secret_question`).
- `signup.js` splits the chosen option's value on `,` and renders the 3 individual questions as a numbered list (`#security-questions-preview`) so the user can see exactly what they're about to answer.
- The single `secret_answer` field now expects all 3 answers, **space-separated, in order** — the field hint states this and gives an example, and notes answers are case-sensitive (per your requirement).
- **Assumption made:** dropped the old "Other — write your own question" option, since sets are now backend-provided presets rather than user-authored. Flagging this in case you still want a custom-question path — happy to add it back.

### 3. Username availability — manual check button
Added a "Check availability" button next to the username field
(`.username-check-row`). On click, `signup.js`:
- Reads the typed **username** and the **email** field's current value (per your correction — no new name fields were added).
- POSTs `{ "username": "...", "email": "..." }` as JSON to a placeholder endpoint, `USERNAME_CHECK_ENDPOINT = '/account/username/availability/'` (top of `signup.js`).
- Shows inline status text (`checking` / `available` / `taken`) using the existing `.username-status[data-state]` styles that were already in `signup.css` but previously unused.
- If the backend response includes `suggested_username`, shows a one-click "Use "..."" button that fills it into the username field.

**TODO for you (backend):** this endpoint does not exist yet. Expected
contract, also documented at the top of `signup.js`:
```
POST /account/username/availability/
body:     { "username": "<value>", "email": "<value>" }
response: { "available": true }
      or  { "available": false, "suggested_username": "..." }
```
Update `USERNAME_CHECK_ENDPOINT` in `signup.js` if you wire it up at a
different path. Also note: `Account/views.py` already has a commented-out
`GenerateUsername` view stub that looks like it was meant for exactly this.

### 4. Logo visibility fix
`httpchat_logo.png` has a transparent background, and its mark is a teal
gradient close in hue to the signup brand panel's own gradient — so the
logo could visually wash out there. Wrapped the `<img>` in a new
`.signup-brand__logo-wrap` div with a solid light backdrop
(`rgba(255,255,255,0.92)`) so it stays visible in both themes.
**Note:** the same PNG is also used as the site favicon
(`base_template.html`'s `favicon` block). A favicon can't get a CSS
backdrop — if that's also washing out in some browser tab bars, the fix
there would mean editing the image asset itself (regenerating the PNG with
a solid backdrop baked in), which is outside HTML/CSS/JS. Flagging this;
didn't touch the image file without checking with you first.

### 5. Transparency / data-use notes
Added short `.field-hint` copy explaining what each piece of data is used
for, next to the fields that changed:
- Username: "We only use this to check the username is free and, if it's already taken, to suggest an available alternative using your email above. Nothing is saved until you submit the form."
- Security questions: "Used only to verify it's you if you ever lose access to your account and email recovery isn't available. We never use these answers for anything else."

### Not changed (out of scope this pass)
- `Account/models.py` — still has one `secret_question` / `secret_answer`
  field pair. The 3-question answers will arrive as one space-separated
  string in `secret_answer`; splitting/validating/hashing them is backend
  work.
- `Account/views.py` / `Account/urls.py` — no routes added; the
  `/account/username/availability/` endpoint referenced in `signup.js` is a
  placeholder for you to implement.

## 2026-08-19 (later same day) — Username check: email made optional + JSON body note

**Reported issue:** username-check button appeared to send nothing —
`request.GET` and `request.POST` were both empty `QueryDict`s in the view.

**Root cause (not a frontend bug):** `signup.js` sends the payload as a
JSON body (`Content-Type: application/json`), which is correct REST
practice, but Django's `request.POST` only ever populates for
form-encoded bodies (`application/x-www-form-urlencoded` /
`multipart/form-data`). An empty `QueryDict` on a JSON POST is expected
Django behaviour, not a sign the request failed to arrive. The view needs
to read `json.loads(request.body)` instead of `request.POST` for this
endpoint (and any other JSON-body endpoint added later):

```python
import json

def post(self, request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"message": "Invalid JSON body."}, status=400)
    username = data.get("username")
    email = data.get("email")  # now optional, see below
```

**Change made:** email is now optional for the availability check, per
your request — recommended (for a more personalized suggested username)
but no longer required to fire the request.
- `signup.js`: removed the `if (!email) return;` guard. The request now
  fires as soon as a username is present; `email` is included in the
  JSON body only when the field has a value (omitted key, not an empty
  string, when blank).
- `signup.html`: updated the username field's hint text from "using your
  email above" (implying required) to "recommended (not required)".

**Verified with jsdom** (headless DOM, `signup.js` executed unmodified
against a minimal copy of the signup form markup, `fetch` stubbed to
capture calls):
- username only → fires, body `{"username":"testuser"}`
- username + email → fires, body `{"username":"testuser","email":"test@example.com"}`
- neither filled → correctly blocked, no request, "Enter a username first."

