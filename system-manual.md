# MAGUMEDS - Medical Aid Management System Manual

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Backend API Reference](#backend-api-reference)
5. [Frontend Dashboard Guide](#frontend-dashboard-guide)
6. [User Workflows](#user-workflows)
7. [Business Logic & Processes](#business-logic--processes)
8. [Administration & Maintenance](#administration--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Security & Compliance](#security--compliance)

---

## System Overview

### 🏥 What is MAGUMEDS?
MAGUMEDS (Medical Aid Management System) is a comprehensive healthcare management platform that digitizes medical aid operations. It connects healthcare providers, patients, and medical aid administrators in a secure, efficient ecosystem for managing claims, benefits, and healthcare services.

### 🏗️ Architecture Overview

**Technology Stack:**
- **Backend**: Django REST Framework (Python)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **Authentication**: JWT with Multi-Factor Authentication (MFA)
- **Encryption**: Field-level encryption for sensitive data
- **Task Queue**: Celery with Redis
- **Monitoring**: Django Silk, Error Tracking, Performance Monitoring

**Key Components:**
- **Accounts App**: User management, authentication, MFA, sessions, credentialing
- **Schemes App**: Benefit structures, subscription tiers, pricing models
- **Claims App**: Claim processing, pre-authorization, fraud detection, invoices
- **Billing App**: Payment processing, billing cycles, financial management
- **Core App**: Analytics, reporting, EDI integration, system settings

### 🎯 Core Business Functions

1. **Claims Management**: Submit, process, and track medical claims
2. **Patient Management**: Member enrollment, benefit tracking, family management
3. **Provider Network**: Healthcare provider credentialing and management
4. **Subscription Billing**: Tiered pricing with monthly/yearly cycles
5. **Pre-authorization**: Automated approval workflows for treatments
6. **Fraud Detection**: AI-powered anomaly detection and alerts
7. **Analytics & Reporting**: Comprehensive healthcare utilization reports

### 🔄 System Workflow Overview

```
Patient Visit → Provider Submits Claim → System Validation → Approval/Rejection → Payment Processing
    ↓              ↓                        ↓              ↓                    ↓
Enrollment    Pre-authorization Check   Benefit Limits    Invoice Generation   Provider Payment
    ↓              ↓                        ↓              ↓                    ↓
Subscription    Coverage Verification   Fraud Detection   Patient Billing      Reconciliation
```

---

## Getting Started

### 📋 Prerequisites

**System Requirements:**
- Python 3.10+
- PostgreSQL 13+
- Redis (for Celery)
- Node.js 18+ (for frontend)
- Git

**Development Environment:**
- Virtual environment (venv/conda)
- Code editor (VS Code recommended)
- Git for version control

### 🚀 Installation & Setup

#### 1. Clone Repository
```bash
git clone <repository-url>
cd medical-aid
```

#### 2. Backend Setup

**Create Virtual Environment:**
```bash
# Windows PowerShell
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python -m venv .venv
source .venv/bin/activate
```

**Install Dependencies:**
```bash
pip install -r requirements.txt
```

**Database Setup:**
```bash
# Create .env file with database configuration
cp .env.example .env

# Edit .env with your PostgreSQL connection
DATABASE_URL=postgres://username:password@localhost:5432/magumeds

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

**Seed Initial Data:**
```bash
# Seed subscription tiers and schemes
python manage.py seed_subscriptions

# Optional: Seed demo coverage scenarios (6 test cases with validation)
python manage.py seed_demo_scenarios
# Use --reset flag to clear and re-seed: python manage.py seed_demo_scenarios --reset

# Optional: Seed test data
python manage.py seed_test_data
```

**Email Configuration:**
```bash
# The system supports multiple email backends:
# 1. Console (development) - emails print to terminal
# 2. SMTP (Gmail, custom SMTP server)
# 3. Transactional providers (Resend, SendGrid, Mailgun, Postmark) via django-anymail

# For local development (DEBUG=True), emails default to console output
# For production, configure one of the following in .env:

# Option 1: Resend (Recommended)
RESEND_API_KEY=re_your_api_key
DEFAULT_FROM_EMAIL=no-reply@your-domain.com

# Option 2: SendGrid
SENDGRID_API_KEY=SG.your_api_key
DEFAULT_FROM_EMAIL=no-reply@your-domain.com

# Option 3: Mailgun
MAILGUN_API_KEY=your_api_key
MAILGUN_SENDER_DOMAIN=mg.your-domain.com
DEFAULT_FROM_EMAIL=no-reply@your-domain.com

# Option 4: SMTP (Gmail - not recommended for production)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password  # Requires Gmail 2FA + App Password
DEFAULT_FROM_EMAIL=your-email@gmail.com

# Test email delivery
python manage.py test_email
# or specify recipient: python manage.py test_email --to you@example.com
```

**Start Development Server:**
```bash
python manage.py runserver
# API available at: http://localhost:8000/api/
# Admin panel: http://localhost:8000/admin/
# API Docs: http://localhost:8000/api/docs/
```

#### 3. Frontend Setup

**Install Dependencies:**
```bash
cd frontend
npm install
```

**Start Development Server:**
```bash
npm run dev
# Frontend available at: http://localhost:5173/
```

#### 4. Additional Services

**Redis Setup (for Celery):**
```bash
# Install Redis (Windows: use Redis for Windows, Linux/Mac: brew install redis)
redis-server

# Start Celery worker
celery -A backend worker -l info

# Start Celery beat (scheduled tasks)
celery -A backend beat -l info
```

### 🔧 Initial Configuration

#### 1. System Settings
Access Django Admin (`/admin/`) and configure:
- System settings (core.SystemSettings)
- Email configuration (see Email Setup section below)
- Payment gateway settings
- EDI integration settings

#### 2. Email Setup

The system uses email notifications for:
- Claim status updates (approved/rejected)
- Pre-authorization decisions
- Subscription renewals
- Payment confirmations
- Fraud alerts

**Email Backend Options:**

**Development (Local):**
- Emails automatically print to the console when `DEBUG=True`
- No SMTP credentials needed for local testing
- See notification workflow in terminal output

**Production (Render/Cloud):**
- Use a transactional email provider (Resend, SendGrid, Mailgun, or Postmark)
- Configure via environment variables (see Getting Started > Email Configuration)
- Gmail SMTP is not recommended due to 2FA/App Password requirements and reliability issues

**Test Email Delivery:**
```bash
# Activate virtual environment first
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Send test email to admin
python manage.py test_email

# Send test email to specific recipient
python manage.py test_email --to recipient@example.com

# Check backend being used
python manage.py test_email --to admin@eiteone.org
# Output shows: Email backend: anymail.backends.resend.EmailBackend
```

**Troubleshooting Email:**
- If emails fail locally: Ensure `DEBUG=True` in `.env` to use console backend
- If emails fail in production: Verify API key is set and `DEFAULT_FROM_EMAIL` is configured
- For Gmail SMTP errors (535): Switch to Resend or another transactional provider
- See `docs/EMAIL_SETUP.md` for detailed configuration guide

#### 3. Create Initial Data

**Demo Coverage Scenarios (Recommended for Testing):**

The system includes a comprehensive seed command for testing claim validation:

```bash
# Activate virtual environment first
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Seed 6 demo scenarios with realistic data
python manage.py seed_demo_scenarios

# Reset and re-seed if needed
python manage.py seed_demo_scenarios --reset
```

**Demo Scenarios Created:**
1. **Coverage Limit Exhausted**: Member exceeds annual benefit maximum → Claim REJECTED
2. **Remaining Balance**: Member has coverage remaining → Claim APPROVED
3. **Deductible & Copay**: Patient responsibility calculated correctly → Claim APPROVED
4. **Waiting Period Not Met**: Service date before benefit activation → Claim REJECTED
5. **Inactive Subscription**: Member subscription expired/inactive → Claim REJECTED
6. **Pre-authorization Required**: High-cost procedure requires approval → Claim PENDING

Each scenario creates:
- Complete scheme with benefits and tiers (Basic/Standard)
- Demo provider (Dr. Demo Provider, Practice ID: PROV-DEMO-001)
- Test member with realistic enrollment data
- Sample claim with appropriate validation outcome

After seeding, you can:
- View demo data in Django Admin (`/admin/`)
- Test claim workflows with pre-configured scenarios
- Verify notification system with test claims
- Use as baseline for understanding claim validation logic

**Manual Data Creation:**

**Schemes & Benefits:**
1. Create scheme categories (Basic, Standard, Premium)
2. Define benefit types (Consultation, Radiology, Pathology, etc.)
3. Set up benefit categories (Core, Premium, Add-on)
4. Create subscription tiers with pricing

**Provider Network:**
1. Register healthcare providers
2. Set up credentialing rules
3. Configure provider tiers (Primary, Secondary, Tertiary)

**Pre-authorization Rules:**
1. Create automated approval rules
2. Set cost thresholds for auto-approval
3. Configure service-specific rules

#### 4. User Setup

**Create Admin User:**
```bash
python manage.py createsuperuser
# Follow prompts to create admin account
```

**Create Test Users:**
```python
# In Django shell
python manage.py shell
from accounts.models import User
from django.contrib.auth.models import Group

# Create provider user
provider = User.objects.create_user(
    username='provider1',
    email='provider@example.com',
    password='password123',
    role='PROVIDER'
)

# Create patient user
patient = User.objects.create_user(
    username='patient1',
    email='patient@example.com',
    password='password123',
    role='PATIENT'
)
```

### ✅ Verification Steps

1. **API Health Check:**
   ```bash
   curl http://localhost:8000/api/schema/
   # Should return OpenAPI schema
   ```

2. **Database Connection:**
   ```bash
   python manage.py dbshell
   # Should connect to PostgreSQL
   ```

3. **Frontend Build:**
   ```bash
   cd frontend && npm run build
   # Should complete without errors
   ```

4. **Authentication Test:**
   ```bash
   # Test login endpoint
   curl -X POST http://localhost:8000/api/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"yourpassword"}'
   ```

---

## User Roles & Permissions

### 👥 User Types

#### 1. **ADMIN** (System Administrator)
**Permissions:**
- Full system access
- User management (create, modify, deactivate)
- Scheme and benefit configuration
- Financial oversight and reporting
- System settings and maintenance
- Fraud investigation and resolution

**Key Responsibilities:**
- Oversee all system operations
- Manage provider credentialing
- Configure pricing and benefits
- Handle escalated claims and disputes
- Monitor system performance and security

#### 2. **PROVIDER** (Healthcare Provider)
**Permissions:**
- Submit and manage claims for their practice
- View patient coverage information
- Access pre-authorization workflows
- View payment history and invoices
- Limited patient data access (treatment-related only)

**Key Responsibilities:**
- Submit accurate claims with proper documentation
- Obtain pre-authorization for covered procedures
- Maintain compliance with medical aid policies
- Provide quality care within network guidelines

#### 3. **PATIENT** (Medical Aid Member)
**Permissions:**
- View personal claims and coverage
- Submit claims for out-of-pocket expenses
- Access benefit utilization information
- View billing and payment history
- Update personal information

**Key Responsibilities:**
- Keep contact information current
- Understand coverage limitations
- Submit claims promptly with receipts
- Pay required co-payments and deductibles

### 🔐 Permission Matrix

| Feature | Admin | Provider | Patient |
|---------|-------|----------|---------|
| View All Claims | ✅ | ❌ | ❌ |
| Submit Claims | ✅ | ✅ | ✅ |
| Approve/Reject Claims | ✅ | ✅ (own) | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| Configure Schemes | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ (own) | ❌ |
| Access Admin Panel | ✅ | ❌ | ❌ |
| View Personal Data | ✅ | ❌ | ✅ |
| Pre-authorization | ✅ | ✅ | ❌ |

### 🛡️ Data Access Controls

#### Role-Based Filtering
- **Admins**: See all data across the system
- **Providers**: Only see claims and patients they serve
- **Patients**: Only see their own data and dependents

#### Field-Level Security
- **Encrypted Fields**: PHI data (diagnoses, treatments, contact info)
- **Masked Data**: Sensitive financial information
- **Audit Trails**: All data access is logged

#### Session Management
- **Timeout**: Sessions expire after 30 minutes of inactivity
- **Concurrent Sessions**: Limited to prevent unauthorized access
- **Device Tracking**: Login attempts tracked by IP and device

---

## Backend API Reference

### 🔗 Base URL
```
http://localhost:8000/api/
```

### 🔐 Authentication

#### JWT Token Flow
```bash
# 1. Login to get tokens
POST /api/auth/login/
{
  "username": "admin",
  "password": "password123"
}
# Response: { "access": "jwt_token", "refresh": "refresh_token" }

# 2. Use access token in requests
GET /api/accounts/me/
Authorization: Bearer <access_token>

# 3. Refresh token when expired
POST /api/auth/refresh/
{
  "refresh": "refresh_token"
}
```

#### MFA Verification
```bash
# After login, if MFA required
POST /api/auth/mfa/verify/
{
  "token": "123456",
  "user_id": 1
}
```

### 📋 API Endpoints by Category

#### Accounts API (`/api/accounts/`)

**User Management:**
```
GET    /api/accounts/me/                    # Current user profile
POST   /api/accounts/register/              # User registration
GET    /api/accounts/sessions/              # User sessions
DELETE /api/accounts/sessions/{id}/         # Logout session
```

**MFA Management:**
```
GET    /api/accounts/mfa/                   # MFA settings
POST   /api/accounts/mfa/                   # Enable MFA
DELETE /api/accounts/mfa/                   # Disable MFA
```

**Provider Credentialing:**
```
GET    /api/accounts/provider-network/      # Provider network
POST   /api/accounts/provider-network/      # Add provider
GET    /api/accounts/credentialing-rules/   # Credentialing rules
POST   /api/accounts/credentialing-reviews/ # Review credentials
```

#### Schemes API (`/api/schemes/`)

**Scheme Management:**
```
GET    /api/schemes/categories/             # Scheme categories
POST   /api/schemes/categories/             # Create scheme
GET    /api/schemes/benefits/               # Scheme benefits
POST   /api/schemes/benefits/               # Add benefit
```

**Subscription System:**
```
GET    /api/schemes/subscription-tiers/     # Available tiers
POST   /api/schemes/subscriptions/          # Create subscription
GET    /api/schemes/subscriptions/          # List subscriptions
PATCH  /api/schemes/subscriptions/{id}/     # Update subscription
```

**Billing:**
```
GET    /api/schemes/invoices/               # Billing invoices
POST   /api/schemes/payments/               # Process payment
GET    /api/schemes/billing-history/        # Payment history
GET    /api/schemes/billing/                # Billing summary
POST   /api/schemes/billing/                # Process payment
```

#### Claims API (`/api/claims/`)

**Claim Management:**
```
GET    /api/claims/                         # List claims
POST   /api/claims/                         # Submit claim
GET    /api/claims/{id}/                    # Claim details
PATCH  /api/claims/{id}/                    # Update claim
DELETE /api/claims/{id}/                    # Delete claim
```

**Pre-authorization:**
```
GET    /api/claims/preauth-requests/        # Pre-auth requests
POST   /api/claims/preauth-requests/        # Submit pre-auth
GET    /api/claims/preauth-approvals/       # Approval decisions
POST   /api/claims/preauth-rules/           # Create approval rule
```

**Fraud Detection:**
```
GET    /api/claims/fraud-alerts/            # Fraud alerts
POST   /api/claims/fraud-alerts/{id}/review # Review alert
```

#### Patients API (`/api/patients/`)

**Patient Management:**
```
GET    /api/patients/                       # List patients
POST   /api/patients/                       # Register patient
GET    /api/patients/{id}/                  # Patient details
PATCH  /api/patients/{id}/                  # Update patient
GET    /api/patients/{id}/claims/           # Patient claims
GET    /api/patients/{id}/coverage/         # Coverage info
```

#### Core API (`/api/core/`)

**Analytics & Reporting:**
```
GET    /api/core/dashboard/                 # Dashboard data
GET    /api/core/analytics/                 # Analytics
GET    /api/core/reports/                   # Reports
POST   /api/core/edi/                       # EDI processing
```

**System Management:**
```
GET    /api/core/settings/                  # System settings
POST   /api/core/alerts/                    # Create alert
GET    /api/core/monitoring/                # System health
```

### 📊 Common API Patterns

#### Filtering & Pagination
```bash
# Filtering
GET /api/claims/?status=PENDING&provider=123

# Pagination
GET /api/claims/?page=2&page_size=50

# Search
GET /api/patients/?search=john
```

#### Response Format
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/claims/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "patient": 123,
      "provider": 456,
      "status": "PENDING",
      "cost": "150.00",
      "date_submitted": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Error Handling
```json
{
  "error": "ValidationError",
  "message": "Claim amount exceeds coverage limit",
  "details": {
    "cost": ["Amount cannot exceed $5000 for this benefit type"]
  }
}
```

---

## Frontend Dashboard Guide

### 🎛️ Dashboard Layout

**Navigation Structure:**
- **Header**: User menu, notifications, search
- **Sidebar**: Main navigation based on user role
- **Main Content**: Page-specific content and actions
- **Footer**: System information and links

### 📱 Page Overview

#### Login Page (`/login`)
- Username/password authentication
- MFA verification (if enabled)
- Remember me option
- Password reset link

#### Dashboard (`/dashboard`)
**Admin View:**
- System health metrics
- Recent claims activity
- Financial summaries
- Fraud alerts
- Quick actions

**Provider View:**
- Practice performance
- Pending claims
- Recent payments
- Patient statistics

**Patient View:**
- Coverage summary
- Recent claims
- Outstanding balances
- Benefit utilization

#### Claims Management (`/claims`)
**Admin Features:**
- All claims table with filtering
- Bulk approve/reject actions
- Status management
- Fraud investigation

**Provider Features:**
- Submit new claims
- Manage existing claims
- Pre-authorization requests
- Payment tracking

**Patient Features:**
- View personal claims
- Submit out-of-pocket claims
- Track claim status
- Download receipts

#### Members/Patients (`/members`)
**Admin Only:**
- Patient registration
- Profile management
- Family linking
- Subscription management
- Coverage tracking

#### Providers (`/providers`)
**Admin Only:**
- Provider registration
- Credentialing workflow
- Network management
- Performance monitoring
- Payment processing

#### Schemes (`/schemes`)
**Admin Only:**
- Scheme configuration
- Benefit setup
- Subscription tiers
- Pricing management
- Coverage rules

#### Analytics (`/analytics`)
**Admin & Provider:**
- Claims analytics
- Financial reports
- Utilization trends
- Performance metrics

#### Settings (`/settings`)
**All Users:**
- Profile management
- Security settings
- Notification preferences
- API access (admin only)

### 🔍 Key UI Components

#### Data Tables
- Sortable columns
- Advanced filtering
- Export functionality
- Bulk actions
- Pagination

#### Forms
- Claim submission form
- Patient registration
- Scheme configuration
- Pre-authorization requests

#### Modals
- Claim details view
- Approval/rejection dialogs
- Patient information
- Subscription management

#### Charts & Visualizations
- Revenue trends
- Claims volume
- Coverage utilization
- Fraud detection metrics

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search |
| `Ctrl+N` | New claim (providers) |
| `Ctrl+S` | Save form |
| `Esc` | Close modal |
| `Ctrl+Enter` | Submit form |

---

## User Workflows

### 👤 Patient Journey

#### 1. Account Setup
1. Receive medical aid membership
2. Create account with member ID
3. Complete profile with personal details
4. Link family members (dependents)
5. Set up payment method

#### 2. Healthcare Visit
1. Visit healthcare provider
2. Provider checks coverage in real-time
3. Receive treatment/services
4. Pay co-payment if required
5. Provider submits claim automatically

#### 3. Claim Tracking
1. Login to patient portal
2. View submitted claims
3. Monitor approval status
4. Receive payment notifications
5. Download Explanation of Benefits (EOB)

#### 4. Annual Renewal
1. Receive renewal notice
2. Review coverage options
3. Update payment information
4. Confirm renewal or change plans

### 👨‍⚕️ Provider Journey

#### 1. Onboarding
1. Register practice with medical aid
2. Submit credentialing documents
3. Complete provider agreement
4. Receive network status confirmation
5. Get access to provider portal

#### 2. Daily Operations
1. Login to provider portal
2. Check patient coverage before treatment
3. Submit claims for services rendered
4. Request pre-authorization for procedures
5. Track claim status and payments

#### 3. Claim Management
1. Submit claims with required documentation
2. Monitor pending claims
3. Handle rejections and resubmit with corrections
4. Receive payments and reconcile accounts
5. Generate practice reports

#### 4. Compliance
1. Maintain credentialing requirements
2. Stay updated on policy changes
3. Complete continuing education
4. Participate in quality improvement programs

### 👥 Admin Journey

#### 1. System Setup
1. Configure system settings
2. Set up schemes and benefits
3. Create subscription tiers
4. Configure pre-authorization rules
5. Set up payment processing

#### 2. Daily Management
1. Review system health and alerts
2. Process high-priority claims
3. Handle member inquiries
4. Monitor fraud detection alerts
5. Review financial reports

#### 3. Provider Management
1. Review provider applications
2. Manage credentialing process
3. Monitor provider performance
4. Handle provider disputes
5. Update provider contracts

#### 4. Member Management
1. Process membership applications
2. Handle coverage changes
3. Manage family additions/removals
4. Process premium adjustments
5. Handle member complaints

---

## Business Logic & Processes

### 💰 Claims Processing Engine

#### Claim Validation Steps
1. **Patient Verification**: Confirm active membership and coverage
2. **Provider Validation**: Verify provider network status and credentials
3. **Benefit Eligibility**: Check if service is covered under patient's plan
4. **Coverage Limits**: Verify remaining benefits in coverage period
5. **Pre-authorization**: Check if procedure requires prior approval
6. **Cost Calculation**: Calculate patient responsibility vs. scheme payment
7. **Fraud Detection**: Run automated fraud checks
8. **Notification**: Send email notification of claim decision to patient and provider

#### Validation Scenarios (Demo Data Available)

The system includes 6 pre-configured demo scenarios that demonstrate claim validation:

1. **Coverage Limit Exhausted**
   - **Scenario**: Member has used full annual benefit ($5,000)
   - **Outcome**: REJECTED
   - **Message**: "Coverage limit exhausted for this benefit"
   - **Patient**: MBR-DEMO-001 (Sarah Demo)

2. **Remaining Balance**
   - **Scenario**: Member has remaining coverage ($4,000 used of $5,000)
   - **Outcome**: APPROVED
   - **Patient Responsibility**: Deductible ($100) + Copay ($50)
   - **Scheme Payment**: Claim amount - patient responsibility
   - **Patient**: MBR-DEMO-002 (John Demo)

3. **Deductible & Copay Calculation**
   - **Scenario**: First claim of benefit period
   - **Outcome**: APPROVED
   - **Calculation**:
     - Deductible: $100 (annual)
     - Copay: $50 (per-visit)
     - Patient Total: $150
     - Scheme Payment: Claim Amount - $150
   - **Patient**: MBR-DEMO-003 (Emily Demo)

4. **Waiting Period Not Met**
   - **Scenario**: Service date before benefit activation period
   - **Outcome**: REJECTED
   - **Message**: "Service provided before waiting period completed"
   - **Waiting Period**: 30 days from enrollment
   - **Patient**: MBR-DEMO-004 (Michael Demo)

5. **Inactive Subscription**
   - **Scenario**: Member subscription expired or inactive
   - **Outcome**: REJECTED
   - **Message**: "Patient subscription is not active"
   - **Verification**: Subscription status checked before processing
   - **Patient**: MBR-DEMO-005 (Jessica Demo)

6. **Pre-authorization Required**
   - **Scenario**: High-cost procedure requiring prior approval
   - **Outcome**: PENDING
   - **Message**: "Pre-authorization required for this service"
   - **Threshold**: Claims > $1,000 require pre-auth
   - **Patient**: MBR-DEMO-006 (David Demo)

**Test Demo Scenarios:**
```bash
# Seed demo data
python manage.py seed_demo_scenarios

# View demo claims in Django Admin
# Navigate to: http://localhost:8000/admin/claims/claim/
# Filter by: Claim ID contains "DEMO"

# Test notification system
# All demo claims trigger email notifications showing:
# - Claim approval/rejection/pending status
# - Patient responsibility amount
# - Rejection reason (if applicable)
# - Next steps for patient/provider
```

#### Approval Workflow
```
Claim Submitted → Initial Validation → Pre-auth Check → Coverage Verification → Auto-approval Check → Manual Review (if needed) → Notification Sent → Payment Processing
```

#### Payment Calculation
```python
# Patient Responsibility
deductible = patient.deductible_amount
copay = benefit.copay_amount
coinsurance = claim_amount * benefit.coinsurance_rate

patient_total = min(deductible + copay + coinsurance, claim_amount)
scheme_payment = claim_amount - patient_total
```

### 📅 Subscription & Billing

#### Subscription Tiers
- **Basic**: Essential coverage, higher co-payments
- **Standard**: Balanced coverage and costs
- **Premium**: Comprehensive coverage, lower out-of-pocket
- **VIP**: Maximum coverage, concierge services

#### Billing Cycles
- **Monthly**: Billed on enrollment anniversary
- **Yearly**: Single annual payment with discount
- **Auto-renewal**: Automatic renewal with payment method on file

#### Proration Logic
```python
# Mid-cycle plan change
days_remaining = (end_date - today).days
total_days = (end_date - start_date).days
prorated_amount = (monthly_rate * days_remaining) / total_days
```

### 🛡️ Fraud Detection

#### Detection Rules
1. **Duplicate Claims**: Same patient, provider, service, date
2. **Unusual Frequency**: Excessive claims in short period
3. **Amount Anomalies**: Claims significantly above normal
4. **Provider Patterns**: Abnormal billing patterns
5. **Patient Patterns**: Multiple providers for same service
6. **Service Mismatch**: Inconsistent diagnosis/treatment codes
7. **Temporal Anomalies**: Claims outside business hours
8. **Network Violations**: Non-network provider claims

#### Alert Severity Levels
- **Low**: Minor anomalies, monitor
- **Medium**: Suspicious patterns, investigate
- **High**: Clear fraud indicators, block and investigate
- **Critical**: Severe violations, immediate action required

### 📊 Analytics & Reporting

#### Key Metrics
- **Claims Volume**: Total claims processed by period
- **Approval Rate**: Percentage of approved claims
- **Average Processing Time**: Days from submission to payment
- **Utilization Rate**: Benefits used vs. available
- **Provider Performance**: Approval rates, claim accuracy
- **Financial Metrics**: Premium revenue, claim payouts, profit margins

#### Automated Reports
- **Daily**: System health, failed payments, high-value claims
- **Weekly**: Utilization trends, provider performance
- **Monthly**: Financial statements, member growth
- **Quarterly**: Comprehensive business review
- **Annual**: Regulatory reporting, trend analysis

---

## Administration & Maintenance

### 🔧 System Administration

#### User Management
```bash
# Create admin user
python manage.py createsuperuser

# Bulk user operations
python manage.py bulk_create_users --file users.csv

# Deactivate users
python manage.py deactivate_users --older-than 365
```

#### Data Management

**Seed Demo Data:**
```bash
# Activate virtual environment first
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Seed demo coverage scenarios (6 test cases)
python manage.py seed_demo_scenarios

# Reset and re-seed demo data
python manage.py seed_demo_scenarios --reset

# What gets created:
# - 1 Demo Scheme (Demo Medical Scheme)
# - 2 Subscription Tiers (Basic/Standard)
# - 1 Benefit Type (Consultation)
# - 2 Benefits (Basic/Standard tier benefits)
# - 1 Demo Provider (Dr. Demo Provider)
# - 6 Demo Members (MBR-DEMO-001 to MBR-DEMO-006)
# - 6 Demo Claims (one for each validation scenario)
```

**Demo Scenarios Included:**
1. Coverage Limit Exhausted → REJECTED
2. Remaining Balance → APPROVED
3. Deductible & Copay → APPROVED
4. Waiting Period Not Met → REJECTED
5. Inactive Subscription → REJECTED
6. Pre-authorization Required → PENDING

**View Demo Data:**
- Django Admin: `http://localhost:8000/admin/`
- Filter claims by: Claim ID contains "DEMO"
- Filter patients by: Member ID contains "DEMO"

**Test Email Notifications:**
```bash
# Send test email to verify email configuration
python manage.py test_email

# Send to specific recipient
python manage.py test_email --to recipient@example.com

# Custom subject and message
python manage.py test_email --to test@example.com --subject "Test" --message "Testing MAGUMEDS email"

# Verify backend being used
# Output shows: Email backend: anymail.backends.resend.EmailBackend
#              From: no-reply@your-domain.com
#              To: recipient@example.com
```

#### Database Maintenance
```bash
# Backup database
pg_dump magumeds > backup_$(date +%Y%m%d).sql

# Restore database
psql magumeds < backup_20240115.sql

# Database optimization
python manage.py vacuum_db
python manage.py reindex_db
```

#### System Monitoring
```bash
# Check system health
curl http://localhost:8000/api/core/monitoring/

# View Celery tasks
celery -A backend inspect active

# Check Redis status
redis-cli ping

# Monitor logs
tail -f logs/django.log
tail -f logs/celery.log
```

### 📊 Performance Optimization

#### Database Optimization
- Regular index maintenance
- Query optimization
- Connection pooling
- Read replicas for reporting

#### Caching Strategy
- Redis for session storage
- Database query caching
- API response caching
- Static file caching

#### Background Tasks
```python
# Celery tasks for heavy operations
@shared_task
def process_bulk_claims(claim_ids):
    # Process multiple claims asynchronously
    pass

@shared_task
def generate_monthly_reports():
    # Generate comprehensive reports
    pass

@shared_task
def cleanup_expired_sessions():
    # Remove old session data
    pass
```

### 🔄 Backup & Recovery

#### Automated Backups
```bash
# Daily database backup
0 2 * * * pg_dump magumeds > /backups/db_$(date +\%Y\%m\%d).sql

# Weekly full system backup
0 3 * * 0 tar -czf /backups/full_$(date +\%Y\%m\%d).tar.gz /app

# Retention policy
find /backups -name "db_*.sql" -mtime +30 -delete
find /backups -name "full_*.tar.gz" -mtime +90 -delete
```

#### Disaster Recovery
1. **Database Recovery**:
   ```bash
   psql magumeds < latest_backup.sql
   python manage.py migrate
   ```

2. **Application Recovery**:
   ```bash
   git checkout main
   pip install -r requirements.txt
   python manage.py collectstatic
   systemctl restart gunicorn
   ```

3. **Data Integrity Checks**:
   ```bash
   python manage.py check_data_integrity
   python manage.py fix_orphaned_records
   ```

### 📈 Scaling Considerations

#### Horizontal Scaling
- Load balancer configuration
- Database read replicas
- Redis cluster setup
- CDN for static files

#### Vertical Scaling
- Database server upgrades
- Application server resources
- Cache memory allocation
- Background worker capacity

#### Monitoring & Alerting
- Application performance monitoring
- Database performance metrics
- Error rate tracking
- Resource utilization alerts

---

## Troubleshooting

### 🔍 Common Issues

#### Email Notification Problems

**Issue**: Email notifications not being sent
**Solutions**:
1. **Check email backend configuration**:
   ```bash
   python manage.py test_email
   # Should show active backend (console/SMTP/anymail)
   ```

2. **Local Development (DEBUG=True)**:
   - Emails default to console output
   - Check terminal/runserver logs for email content
   - No SMTP credentials needed
   - To test with real email, set `RESEND_API_KEY` in `.env`

3. **Production (Render/Cloud)**:
   - Verify environment variables are set:
     - `RESEND_API_KEY` (or other provider)
     - `DEFAULT_FROM_EMAIL`
   - Check provider API key is valid
   - Verify sender domain is configured
   - Review application logs for email errors

**Issue**: Gmail SMTP 535 error (Bad credentials)
**Solutions**:
1. **Switch to Resend (Recommended)**:
   - Sign up at resend.com
   - Generate API key
   - Set in `.env`: `RESEND_API_KEY=re_your_key`
   - Set `DEFAULT_FROM_EMAIL=no-reply@your-domain.com`
   - Test: `python manage.py test_email`

2. **If continuing with Gmail**:
   - Enable 2-Factor Authentication on Google account
   - Generate App Password (not regular password)
   - Use App Password in `EMAIL_HOST_PASSWORD`
   - Note: Not recommended for production due to reliability issues

**Issue**: Emails sent but not received
**Solutions**:
1. Check spam/junk folders
2. Verify `DEFAULT_FROM_EMAIL` is a valid sender
3. For custom domains: Configure SPF/DKIM records
4. Review provider dashboard for delivery failures
5. Test with known working email: `python manage.py test_email --to admin@eiteone.org`

**Issue**: Email backend showing wrong configuration
**Solutions**:
1. Check `.env` file for conflicting settings
2. Verify environment variables are loaded: `python manage.py shell -c "from django.conf import settings; print(settings.EMAIL_BACKEND)"`
3. Restart Django server after `.env` changes
4. Priority order: Resend > SendGrid > Mailgun > Postmark > SMTP > Console (if DEBUG)

**Testing Email Delivery:**
```bash
# Activate virtual environment
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Test with default recipient (ADMIN_EMAIL)
python manage.py test_email

# Test with specific recipient
python manage.py test_email --to your-email@example.com

# Test with custom subject/message
python manage.py test_email --to test@example.com --subject "Test Email" --message "Hello from MAGUMEDS"

# Expected output:
# Email backend: anymail.backends.resend.EmailBackend
# From: no-reply@your-domain.com
# To: test@example.com
# Test email sent successfully.
```

**Email Configuration Reference:**
- See `docs/EMAIL_SETUP.md` for comprehensive email setup guide
- Supported providers: Resend, SendGrid, Mailgun, Postmark
- Gmail SMTP fallback available but not recommended

#### Authentication Problems
**Issue**: Unable to login
**Solutions**:
1. Check username/password
2. Verify account is active
3. Check MFA requirements
4. Review failed login attempts

**Issue**: Session timeout
**Solutions**:
1. Refresh authentication token
2. Check session timeout settings
3. Verify concurrent session limits

#### Claim Processing Issues
**Issue**: Claims stuck in pending
**Solutions**:
1. Check pre-authorization requirements
2. Verify patient coverage
3. Review provider credentials
4. Check system queue status

**Issue**: Incorrect coverage calculation
**Solutions**:
1. Verify benefit configuration
2. Check benefit period dates
3. Review patient subscription
4. Validate calculation logic

#### Database Issues
**Issue**: Connection timeouts
**Solutions**:
1. Check database server status
2. Verify connection pool settings
3. Review network connectivity
4. Check database load

**Issue**: Slow queries
**Solutions**:
1. Review query execution plans
2. Check index usage
3. Optimize database configuration
4. Consider query caching

#### API Issues
**Issue**: 500 Internal Server Error
**Solutions**:
1. Check application logs
2. Verify database connectivity
3. Review error stack traces
4. Check system resource usage

**Issue**: Rate limiting
**Solutions**:
1. Review API usage patterns
2. Check rate limit configuration
3. Implement request throttling
4. Consider API key rotation

### 🛠️ Diagnostic Tools

#### System Health Checks
```bash
# API health check
curl http://localhost:8000/api/core/health/

# Database connectivity
python manage.py dbshell -c "SELECT 1;"

# Redis connectivity
redis-cli ping

# Celery worker status
celery -A backend inspect stats
```

#### Log Analysis
```bash
# View recent errors
tail -f logs/django.log | grep ERROR

# Search for specific issues
grep "Claim.*failed" logs/django.log

# Performance monitoring
python manage.py shell -c "from django.core.cache import cache; print(cache.get('performance_metrics'))"
```

#### Data Validation
```bash
# Check data integrity
python manage.py check_data_integrity

# Validate claim calculations
python manage.py validate_claims --date-range 2024-01-01:2024-01-31

# Audit user permissions
python manage.py audit_permissions
```

### 🚨 Emergency Procedures

#### System Outage
1. **Assess Impact**: Determine affected services
2. **Communicate**: Notify stakeholders
3. **Investigate**: Check logs and monitoring
4. **Restore**: Implement recovery procedures
5. **Monitor**: Watch for recurrence

#### Data Breach Response
1. **Contain**: Isolate affected systems
2. **Assess**: Determine breach scope
3. **Notify**: Report to authorities and affected parties
4. **Remediate**: Fix vulnerabilities
5. **Review**: Conduct post-incident analysis

#### High-Priority Issues
- **Payment Failures**: Immediate investigation required
- **Claim Processing Stopped**: Critical business impact
- **Security Alerts**: Potential breach indicators
- **Data Corruption**: Integrity compromise

---

## Security & Compliance

### 🔒 Security Measures

#### Data Protection
- **Encryption**: AES-256 for sensitive data at rest
- **TLS**: End-to-end encryption for data in transit
- **Key Management**: Secure key rotation and storage
- **Data Masking**: Sensitive data hidden from unauthorized users

#### Access Control
- **Role-Based Access**: Strict permission enforcement
- **Multi-Factor Authentication**: Required for admin accounts
- **Session Management**: Automatic timeout and monitoring
- **Audit Logging**: All access and changes tracked

#### Network Security
- **Firewall**: Restricted network access
- **DDoS Protection**: Traffic monitoring and filtering
- **Intrusion Detection**: Real-time threat monitoring
- **VPN Requirements**: Secure remote access

### 📋 Compliance Requirements

#### GDPR/POPIA Compliance
- **Data Subject Rights**: Access, rectification, erasure
- **Consent Management**: Explicit consent for data processing
- **Data Retention**: Configurable retention periods
- **Breach Notification**: Automated breach detection and reporting

#### Healthcare Regulations
- **HIPAA Compliance**: Protected health information safeguards
- **Data Privacy**: Patient information protection
- **Audit Trails**: Complete activity logging
- **Access Controls**: Role-based data access

#### Financial Compliance
- **PCI DSS**: Payment data protection
- **SOX Compliance**: Financial reporting controls
- **AML**: Anti-money laundering measures
- **Fraud Prevention**: Automated fraud detection

### 🔍 Security Monitoring

#### Continuous Monitoring
- **Log Analysis**: Real-time security event monitoring
- **Intrusion Detection**: Network and application monitoring
- **Vulnerability Scanning**: Regular security assessments
- **Compliance Auditing**: Automated compliance checks

#### Incident Response
- **Security Alerts**: Automated threat detection
- **Response Procedures**: Defined incident response plans
- **Forensic Analysis**: Detailed incident investigation
- **Recovery Procedures**: Secure system restoration

### 🛡️ Best Practices

#### Development Security
- **Code Reviews**: Security-focused code review process
- **Vulnerability Scanning**: Automated security testing
- **Dependency Management**: Regular security updates
- **Secure Coding**: OWASP guideline compliance

#### Operational Security
- **Change Management**: Controlled deployment process
- **Backup Security**: Encrypted backup storage
- **Access Reviews**: Regular permission audits
- **Training**: Security awareness training

---

*This manual provides comprehensive guidance for operating the MAGUMEDS system. For additional support or questions, please contact the system administrator or refer to the technical documentation.*