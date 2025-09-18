# Medical Aid Management System - Security Implementation

## Phase 1 Security Infrastructure

This document outlines the security implementations completed for Phase 1 of the Medical Aid Management System, focusing on HIPAA/GDPR compliance for healthcare data.

## 🔐 Security Features Implemented

### 1. Data Encryption for PHI (Protected Health Information)

**Location**: `core/encryption.py`

**Features**:
- Fernet symmetric encryption for sensitive data
- Custom encrypted field types for Django models:
  - `EncryptedCharField` - For encrypted character fields
  - `EncryptedTextField` - For encrypted text fields
  - `EncryptedDateField` - For encrypted date fields
- Automatic encryption/decryption at database level
- Secure key management with environment variables

**Encrypted Fields**:
- Patient phone numbers
- Medical diagnoses
- Diagnosis codes
- Treatment details
- Personal health information

### 2. Enhanced Authentication with MFA

**Location**: `accounts/views_mfa.py`, `accounts/models.py`

**Features**:
- TOTP (Time-based One-Time Password) authentication
- QR code generation for authenticator apps
- Backup codes for account recovery
- Role-based MFA requirements (Admin, Provider roles)
- Secure MFA setup and verification endpoints

**API Endpoints**:
- `POST /api/auth/mfa/setup/` - Setup MFA for user
- `POST /api/auth/mfa/verify/` - Verify MFA code
- `POST /api/auth/mfa/disable/` - Disable MFA
- `GET /api/auth/mfa/status/` - Check MFA status

### 3. Session Management & Security

**Location**: `accounts/middleware.py`, `accounts/views_sessions.py`

**Features**:
- Comprehensive session tracking with database storage
- Concurrent session limits (configurable per user)
- Session timeout enforcement
- Suspicious activity detection
- Device fingerprinting
- Geographic location tracking
- Administrative session management

**Security Middleware**:
- `SessionSecurityMiddleware` - Monitors session activity
- `SessionTimeoutMiddleware` - Enforces session timeouts
- Automatic cleanup of expired sessions

## 🏗️ Architecture Overview

### Database Schema Changes

**New Models**:
- `UserSession` - Tracks all user sessions
- `SessionSettings` - Configurable session policies

**Updated Models**:
- `User` - Added MFA fields
- `Patient` - Encrypted PHI fields
- `Claim` - Encrypted medical details

### Middleware Stack

```python
MIDDLEWARE = [
    # ... existing middleware
    'accounts.middleware.SessionSecurityMiddleware',
    'accounts.middleware.SessionTimeoutMiddleware',
    # ... other middleware
]
```

## 🚀 Usage Guide

### Setting up Encryption

1. Generate encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

2. Add to environment variables:
```bash
export ENCRYPTION_KEY="your-generated-key-here"
```

### MFA Setup

1. User initiates MFA setup via API
2. System generates QR code for authenticator app
3. User scans QR code and provides first TOTP code
4. MFA is enabled for the user

### Session Management

1. Sessions are automatically tracked on login
2. Administrators can view/manage user sessions
3. Expired sessions are cleaned up automatically
4. Suspicious activity triggers alerts

## 🔧 Management Commands

### Session Cleanup

Run periodic cleanup of expired sessions:

```bash
# Dry run to see what would be cleaned
python manage.py cleanup_sessions --dry-run

# Clean sessions older than 30 days
python manage.py cleanup_sessions --days 30
```

### Windows Task Scheduler Setup

Run the setup script to get Task Scheduler configuration:

```bash
python setup_session_cleanup.py
```

## 🧪 Testing

Run comprehensive security tests:

```bash
python test_security.py
```

Tests cover:
- Encryption/decryption functionality
- MFA setup and verification
- Session creation and cleanup
- Encrypted model field operations

## 📋 Security Policies

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Session Policies
- Maximum concurrent sessions: 5 (configurable)
- Session timeout: 8 hours of inactivity
- Automatic logout on suspicious activity

### MFA Requirements
- Required for Admin and Provider roles
- Optional for Patient role
- Backup codes provided for account recovery

## 🔍 Monitoring & Auditing

### Session Monitoring
- Real-time session tracking
- Device and location logging
- Suspicious activity detection
- Administrative dashboard for session management

### Audit Logging
- All authentication events logged
- Session creation/modification tracked
- Failed login attempts monitored
- Administrative actions audited

## 🚨 Security Alerts

The system monitors for:
- Multiple failed login attempts
- Concurrent session limit exceeded
- Unusual login locations
- Session hijacking attempts
- MFA bypass attempts

## 📚 API Documentation

### Authentication Endpoints

#### MFA Setup
```http
POST /api/auth/mfa/setup/
Authorization: Bearer <token>
```

Response:
```json
{
  "qr_code_url": "otpauth://totp/...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backup_codes": ["12345678", "87654321", ...]
}
```

#### MFA Verification
```http
POST /api/auth/mfa/verify/
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

### Session Management Endpoints

#### List User Sessions
```http
GET /api/auth/sessions/
Authorization: Bearer <token>
```

#### Terminate Session
```http
DELETE /api/auth/sessions/{session_id}/
Authorization: Bearer <token>
```

## 🔧 Configuration

### Environment Variables

```bash
# Encryption
ENCRYPTION_KEY=your-fernet-key-here

# Session Settings
SESSION_TIMEOUT_HOURS=8
MAX_CONCURRENT_SESSIONS=5

# MFA Settings
MFA_ISSUER=MedicalAidSystem
```

### Django Settings

Add to `backend/settings.py`:

```python
# Security middleware
MIDDLEWARE = [
    # ... existing middleware
    'accounts.middleware.SessionSecurityMiddleware',
    'accounts.middleware.SessionTimeoutMiddleware',
]

# Installed apps
INSTALLED_APPS = [
    # ... existing apps
    'django_otp',
    'django_otp.plugins.otp_totp',
]

# Session settings
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
```

## 🚦 Next Steps (Phase 2)

1. **Password Policies** - Implement advanced password requirements
2. **Audit Logging** - Comprehensive audit trails for all data access
3. **API Rate Limiting** - Prevent brute force and DoS attacks
4. **Data Masking** - Additional layer of data protection
5. **Security Headers** - Implement security headers middleware

## 📞 Support

For security-related issues or questions:
- Check the test suite: `python test_security.py`
- Review logs for security events
- Contact security team for policy questions

---

**Note**: This implementation provides a solid foundation for HIPAA/GDPR compliance. Regular security audits and updates are recommended.