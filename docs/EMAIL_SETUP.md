# Email Setup (Local and Render)

This project supports two reliable email paths:
- Development: console backend (prints emails to terminal)
- Production: transactional provider via Anymail (SendGrid/Mailgun/Postmark/Resend)

Gmail SMTP is not recommended for production and often fails due to 2FA/app-password policies. Prefer a provider.

## Quick start (recommended: SendGrid)

1) Create a SendGrid account and generate an API key with Mail Send permission.
2) In Render (or your prod env), set these environment variables:
   - `SENDGRID_API_KEY` = <your key>
   - `DEFAULT_FROM_EMAIL` = notifications@your-domain
3) Locally, leave `SENDGRID_API_KEY` unset; emails will use console backend in DEBUG.

The settings will automatically switch to `anymail.backends.sendgrid.EmailBackend` when `SENDGRID_API_KEY` is present.

## Environment variables

Core (always available):
- `EMAIL_BACKEND` (optional). Defaults: console in DEBUG; SMTP otherwise.
- `DEFAULT_FROM_EMAIL`: From address (e.g., notifications@your-domain)
- `ADMIN_EMAIL`: For test/alerts (default admin@eiteone.org)

SMTP (fallback):
- `EMAIL_HOST` (default smtp.gmail.com)
- `EMAIL_PORT` (587)
- `EMAIL_USE_TLS` (True)
- `EMAIL_USE_SSL` (False)
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`

Anymail (auto-switch when present):
- `SENDGRID_API_KEY`
- `MAILGUN_API_KEY`, `MAILGUN_SENDER_DOMAIN`
- `POSTMARK_SERVER_TOKEN`
- `RESEND_API_KEY`

## Local development

By default in DEBUG, the project uses the console backend:
- Emails print to the runserver terminal.
- This removes the need for SMTP credentials locally.

Optionally, to test SMTP locally (not recommended):
- Export the SMTP variables above; ensure credentials are valid (e.g., Gmail App Password if 2FA enabled).

## Test email

Use the management command to send a test message using the active backend:

```powershell
# From project root (activate venv first)
python manage.py test_email --to you@example.com
```

If `--to` is omitted, it will use `ADMIN_EMAIL`.

## Gmail notes (if you must)

- Enable 2FA and create an App Password; use that for `EMAIL_HOST_PASSWORD`.
- Regular account passwords will be rejected by Google (error 535 BadCredentials).
- Less secure apps is deprecated; use app passwords only.

## Render notes

- Add the SendGrid add-on or just set `SENDGRID_API_KEY` in your Render service env.
- Set `DEFAULT_FROM_EMAIL` to a valid domain/sender.
- No SMTP config is needed when using Anymail + SendGrid.
