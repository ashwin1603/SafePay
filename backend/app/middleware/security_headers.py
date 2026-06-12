"""
Security headers + hard body-size limit.

Adds defence-in-depth HTTP response headers (CSP, HSTS, anti-clickjacking,
MIME-sniffing protection, referrer + permissions policy) and rejects
over-large request bodies before they are buffered.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

MAX_BODY_BYTES = 1_000_000  # 1 MB — payment/auth payloads are tiny

_CSP = (
    "default-src 'self'; "
    "img-src 'self' data:; "
    "script-src 'self' https://js.stripe.com; "
    "style-src 'self' 'unsafe-inline'; "
    "connect-src 'self' https://api.stripe.com; "
    "frame-src https://js.stripe.com; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > MAX_BODY_BYTES:
                    return JSONResponse(status_code=413,
                                        content={"detail": "Request body too large"})
            except ValueError:
                return JSONResponse(status_code=400,
                                    content={"detail": "Invalid Content-Length"})

        response = await call_next(request)
        h = response.headers
        h["X-Content-Type-Options"] = "nosniff"
        h["X-Frame-Options"] = "DENY"
        h["Referrer-Policy"] = "no-referrer"
        h["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        h["Content-Security-Policy"] = _CSP
        h["Cross-Origin-Opener-Policy"] = "same-origin"
        h["Cross-Origin-Resource-Policy"] = "same-origin"
        h["Cache-Control"] = "no-store"
        # HSTS only meaningful over HTTPS; safe to always send in prod.
        if settings.is_production:
            h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        if "Server" in h:
            del h["Server"]
        return response
