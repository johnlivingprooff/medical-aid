"""
Encryption utilities for handling sensitive data (PHI) in the Medical Aid system.
Provides encrypted field types and key management for HIPAA/GDPR compliance.
"""

import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from django.db import models
from django.core.exceptions import ImproperlyConfigured


class EncryptionManager:
    """Manages encryption keys and provides encryption/decryption services."""

    def __init__(self):
        self._key = None
        self._fernet = None

    @property
    def key(self):
        """Get or generate the encryption key."""
        if self._key is None:
            self._key = self._get_or_create_key()
        return self._key

    @property
    def fernet(self):
        """Get the Fernet cipher instance."""
        if self._fernet is None:
            self._fernet = Fernet(self.key)
        return self._fernet

    def _get_or_create_key(self):
        """Get existing key or create a new one."""
        key_env = getattr(settings, 'ENCRYPTION_KEY', None)
        if key_env:
            # Use key from environment
            return key_env.encode()

        # Generate a persistent key (for development only)
        # In production, this should be set via environment variable
        # Use a fixed salt for development to ensure consistency
        salt = b'dev_salt_medical_aid_2024'  # Fixed salt for development
        password = getattr(settings, 'SECRET_KEY', 'default-dev-key').encode()

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        return key

    def encrypt(self, plaintext):
        """Encrypt plaintext data."""
        if plaintext is None or plaintext == '':
            return plaintext

        if isinstance(plaintext, str):
            plaintext = plaintext.encode('utf-8')

        encrypted = self.fernet.encrypt(plaintext)
        return encrypted.decode('utf-8')

    def decrypt(self, ciphertext):
        """Decrypt ciphertext data."""
        if ciphertext is None or ciphertext == '':
            return ciphertext

        if isinstance(ciphertext, str):
            ciphertext = ciphertext.encode('utf-8')

        try:
            decrypted = self.fernet.decrypt(ciphertext)
            return decrypted.decode('utf-8')
        except Exception as e:
            # Log the error but don't expose sensitive information
            print(f"Decryption failed: {type(e).__name__}")
            return "[ENCRYPTED DATA]"


# Global encryption manager instance
encryption_manager = EncryptionManager()


class EncryptedCharField(models.CharField):
    """Encrypted character field for sensitive data."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        """Decrypt data when loading from database."""
        if value is None:
            return value
        return encryption_manager.decrypt(value)

    def to_python(self, value):
        """Decrypt data when converting to Python."""
        if value is None:
            return value
        return encryption_manager.decrypt(value)

    def get_prep_value(self, value):
        """Encrypt data before saving to database."""
        if value is None:
            return value
        return encryption_manager.encrypt(value)

    def get_col(self, alias, output_field=None):
        """Ensure proper column handling."""
        if output_field is None:
            output_field = self
        return super().get_col(alias, output_field)


class EncryptedTextField(models.TextField):
    """Encrypted text field for sensitive data."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        """Decrypt data when loading from database."""
        if value is None:
            return value
        return encryption_manager.decrypt(value)

    def to_python(self, value):
        """Decrypt data when converting to Python."""
        if value is None:
            return value
        return encryption_manager.decrypt(value)

    def get_prep_value(self, value):
        """Encrypt data before saving to database."""
        if value is None:
            return value
        return encryption_manager.encrypt(value)

    def get_col(self, alias, output_field=None):
        """Ensure proper column handling."""
        if output_field is None:
            output_field = self
        return super().get_col(alias, output_field)


class EncryptedDateField(models.DateField):
    """Encrypted date field for sensitive dates like date of birth."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        """Decrypt data when loading from database."""
        if value is None:
            return value
        decrypted = encryption_manager.decrypt(value)
        if decrypted and decrypted != "[ENCRYPTED DATA]":
            from datetime import datetime
            try:
                return datetime.fromisoformat(decrypted).date()
            except ValueError:
                return None
        return None

    def to_python(self, value):
        """Handle date conversion."""
        if value is None:
            return value
        if isinstance(value, str):
            decrypted = encryption_manager.decrypt(value)
            if decrypted and decrypted != "[ENCRYPTED DATA]":
                from datetime import datetime
                try:
                    return datetime.fromisoformat(decrypted).date()
                except ValueError:
                    return None
        return value

    def get_prep_value(self, value):
        """Encrypt data before saving to database."""
        if value is None:
            return value
        if hasattr(value, 'isoformat'):
            # Convert date to ISO format string before encryption
            iso_string = value.isoformat()
            return encryption_manager.encrypt(iso_string)
        return encryption_manager.encrypt(str(value))

    def get_col(self, alias, output_field=None):
        """Ensure proper column handling."""
        if output_field is None:
            output_field = self
        return super().get_col(alias, output_field)


def get_encryption_key():
    """Get the current encryption key (for backup/admin purposes)."""
    return encryption_manager.key.decode('utf-8')


def rotate_encryption_key():
    """Rotate the encryption key (requires re-encryption of all data)."""
    # This is a complex operation that requires:
    # 1. Decrypting all data with old key
    # 2. Generating new key
    # 3. Re-encrypting all data with new key
    # 4. Updating the key in settings
    raise NotImplementedError("Key rotation requires careful planning and data migration")