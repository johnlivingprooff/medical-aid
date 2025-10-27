# Production Database Initialization and Demo Seed Runbook

This runbook initializes the database, creates an admin, and (optionally) seeds six coverage scenarios for demos/QA.

Important
- Always activate the Python virtual environment first
- Run commands in Windows PowerShell (this repo is configured for PowerShell)
- Seeding is idempotent; you can run it multiple times

## 1) Activate virtual environment

```powershell
.venv\Scripts\activate
```

If you don't have a virtual env, create one first:
```powershell
py -3 -m venv .venv; .venv\Scripts\activate; python -m pip install --upgrade pip; pip install -r requirements.txt
```

## 2) Apply migrations

```powershell
python manage.py makemigrations; python manage.py migrate
```

## 3) Create a superuser (admin)

```powershell
python manage.py createsuperuser
```

Follow the prompts to set username, email, and password.

## 4) System sanity check

```powershell
python manage.py check
```

This validates that Django can load settings, models, and apps without errors.

## 5) Optional: Seed coverage demo scenarios

This creates a demo scheme, benefit types, benefits, two tiers, one demo provider, and six demo members (one per scenario). It also creates representative claims demonstrating each scenario.

```powershell
# First-time seed (idempotent)
python manage.py seed_demo_scenarios

# Reset then reseed (deletes demo users + claims only)
python manage.py seed_demo_scenarios --reset
```

What gets created
- Scheme: "Demo Medical Scheme"
- Benefit Types: GP Consultation, Laboratory Test, Surgery, Maternity Care, Pediatric Care
- Benefits: coverage caps, waiting periods, and preauth rules as needed
- Tiers: Basic and Standard (monthly/yearly pricing)
- Users:
  - Provider: demo_provider / provider123!
  - Members: demo_member_limit, demo_member_balance, demo_member_copay, demo_member_wait, demo_member_inactive, demo_member_preauth (all with password member123!)
- Claims (status varies by scenario)

Scenarios
1) Coverage limit exhausted (Laboratory Test): prior approved claims use up the cap; new claim demonstrates partial/limited approval behavior
2) Remaining balance (GP Consultation): cap has room, new claim approved
3) Deductible + copay (GP Consultation): invoice will reflect member responsibility
4) Waiting period not met (Maternity Care): claim rejected with waiting period message
5) Subscription inactive/expired: claim rejected due to subscription status
6) Pre-authorization required (Surgery): claim pending until preauth is provided

## 6) How to verify

- Admin UI/API: Log in as your superuser and browse to the patients/claims endpoints
- Provider experience: Log in as demo_provider (password: provider123!)
- Members (demo_… users) each represent one scenario; submit/view claims accordingly

Common endpoints
- API root: http://localhost:8000/api/
- Swagger/OpenAPI: http://localhost:8000/api/docs/ or /api/schema/

## 7) Safety and cleanup

- The seeding command is idempotent: re-running will reuse existing scheme/types/tiers and users
- Use `--reset` to remove demo users/claims if you need a clean slate
- The command avoids deleting shared master data (scheme/benefit types) to prevent breaking non-demo data

## 8) Troubleshooting

- Make sure the virtual environment is active before any Python/Django command
- If migrations fail, run again after ensuring requirements are installed
- If encrypted model fields cause issues for manual object creation in the shell, prefer using the management commands

## 9) Next steps

- Populate real schemes/benefits via admin
- Configure provider network if needed
- Adjust `SystemSettings` (e.g., `PREAUTH_THRESHOLD`) via admin for your environment
