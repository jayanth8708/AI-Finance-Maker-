"""
Email service using Resend API.
Falls back to logging OTP to console in development if RESEND_API_KEY is not set.
"""
import resend
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_html_template(otp: str, purpose: str, name: str) -> str:
    action = "verify your email address" if purpose == "email_verification" else "complete your login"
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
    .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #16a34a, #15803d); padding: 32px 40px; text-align: center; }}
    .header h1 {{ color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
    .body {{ padding: 40px; }}
    .greeting {{ font-size: 18px; color: #111; font-weight: 600; margin-bottom: 12px; }}
    .text {{ color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }}
    .otp-box {{ background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 28px; }}
    .otp {{ font-size: 40px; font-weight: 800; color: #15803d; letter-spacing: 10px; font-family: monospace; }}
    .expiry {{ color: #888; font-size: 13px; margin-top: 8px; }}
    .footer {{ background: #fafafa; border-top: 1px solid #eee; padding: 20px 40px; text-align: center; color: #aaa; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>AI Finance Maker</h1></div>
    <div class="body">
      <div class="greeting">Hello, {name}!</div>
      <p class="text">
        Use the one-time password below to {action}.<br>
        This code expires in <strong>5 minutes</strong> and can only be used once.
      </p>
      <div class="otp-box">
        <div class="otp">{otp}</div>
        <div class="expiry">Valid for 5 minutes &bull; Do not share this code</div>
      </div>
      <p class="text" style="font-size:13px; color:#888;">
        If you did not request this code, please ignore this email.
        Your account remains secure.
      </p>
    </div>
    <div class="footer">
      &copy; 2025 AI Finance Maker &bull; Secure Personal Finance
    </div>
  </div>
</body>
</html>
"""


def send_otp_email(to_email: str, name: str, otp: str, purpose: str) -> bool:
    """
    Send OTP email via Resend.
    Returns True on success, raises on failure.
    """
    subject_map = {
        "email_verification": "Verify your AI Finance Maker account",
        "login": "Your AI Finance Maker login code",
    }
    subject = subject_map.get(purpose, "Your one-time password")

    if not settings.RESEND_API_KEY:
        # Development fallback: log OTP to console
        logger.warning(
            f"[DEV MODE] RESEND_API_KEY not set. OTP for {to_email}: {otp}"
        )
        print(f"\n{'='*50}")
        print(f"[DEV] OTP for {to_email}: {otp}")
        print(f"{'='*50}\n")
        return True

    resend.api_key = settings.RESEND_API_KEY
    try:
        response = resend.Emails.send({
            "from": f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": _get_html_template(otp, purpose, name),
        })
        logger.info(f"OTP email sent to {to_email}, id={response.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        raise RuntimeError(f"Failed to send verification email: {e}") from e
