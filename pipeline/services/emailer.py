import os
import smtplib
import ssl
import logging
from typing import Optional


logger = logging.getLogger(__name__)


class EmailClient:
    def __init__(self):
        self.host = os.getenv("SMTP_HOST")
        self.port = int(os.getenv("SMTP_PORT", "587"))
        self.username = os.getenv("SMTP_USERNAME")
        self.password = os.getenv("SMTP_PASSWORD")
        self.from_address = os.getenv("SMTP_FROM", "alerts@blostem.com")
        self.use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
        self.enabled = bool(self.host and self.username and self.password)
        if not self.enabled:
            logger.info("SMTP not fully configured; alert emails disabled.")

    def send_email(self, to_address: str, subject: str, body: str) -> bool:
        if not self.enabled:
            return False
        message = (
            f"From: {self.from_address}\r\n"
            f"To: {to_address}\r\n"
            f"Subject: {subject}\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            f"{body}"
        )
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(self.host, self.port, timeout=20) as server:
                if self.use_tls:
                    server.starttls(context=context)
                server.login(self.username, self.password)
                server.sendmail(self.from_address, [to_address], message.encode("utf-8"))
            return True
        except Exception as exc:
            logger.warning("Failed to send email to %s: %s", to_address, exc)
            return False


email_client = EmailClient()

__all__ = ["email_client", "EmailClient"]
