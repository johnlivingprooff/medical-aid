from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail, get_connection
from django.conf import settings


class Command(BaseCommand):
    help = "Send a test email using the currently configured email backend."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            dest="to",
            help="Recipient email address. Defaults to settings.ADMIN_EMAIL.",
        )
        parser.add_argument(
            "--subject",
            dest="subject",
            default="Medical Aid: Test Email",
            help="Subject line for the test email.",
        )
        parser.add_argument(
            "--message",
            dest="message",
            default=(
                "This is a test email sent by the Medical Aid system to verify "
                "outbound email configuration. If you see this, email delivery "
                "is functioning."
            ),
            help="Message body for the test email.",
        )

    def handle(self, *args, **options):
        recipient = options.get("to") or getattr(settings, "ADMIN_EMAIL", None)
        if not recipient:
            raise CommandError(
                "No recipient provided and settings.ADMIN_EMAIL is not set. "
                "Pass --to you@example.com or set ADMIN_EMAIL."
            )

        backend = getattr(settings, "EMAIL_BACKEND", "<unset>")
        default_from = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")

        self.stdout.write(self.style.NOTICE(f"Email backend: {backend}"))
        self.stdout.write(self.style.NOTICE(f"From: {default_from}"))
        self.stdout.write(self.style.NOTICE(f"To: {recipient}"))

        try:
            # Attempt to get a connection to surface backend misconfiguration early
            with get_connection() as connection:
                sent = send_mail(
                    subject=options["subject"],
                    message=options["message"],
                    from_email=default_from,
                    recipient_list=[recipient],
                    fail_silently=False,
                    connection=connection,
                )
            if sent:
                self.stdout.write(self.style.SUCCESS("Test email sent successfully."))
            else:
                raise CommandError("send_mail returned 0; email not sent.")
        except Exception as exc:
            raise CommandError(f"Failed to send test email: {exc}")
