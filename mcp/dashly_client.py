"""
Thin HTTP wrapper around the Dashly API.

Logs in once using credentials from environment variables, caches the JWT,
and attaches it to every subsequent request. Refreshes the token once on 401.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx


class DashlyAPIError(RuntimeError):
    """Raised when the Dashly API returns an unexpected response."""


class DashlyClient:
    """Small synchronous client for the Dashly REST API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (base_url or os.getenv("DASHLY_BASE_URL", "http://localhost:3000")).rstrip("/")
        self.email = email or os.getenv("DASHLY_EMAIL")
        self.password = password or os.getenv("DASHLY_PASSWORD")
        if not self.email or not self.password:
            raise RuntimeError(
                "DASHLY_EMAIL and DASHLY_PASSWORD must be set via environment or .env file. "
                "See .env.example for the expected variable names."
            )
        self._client = httpx.Client(timeout=timeout)
        self._token: Optional[str] = None

    def login(self) -> str:
        """Authenticate with Dashly and cache the JWT. Returns the token."""
        url = f"{self.base_url}/api/auth/login"
        try:
            resp = self._client.post(
                url, json={"email": self.email, "password": self.password}
            )
        except httpx.RequestError as err:
            raise DashlyAPIError(
                f"Cannot reach Dashly at {self.base_url}: {err}. "
                "Is the API running? Start it with `npm start` in the repo root."
            ) from err
        if resp.status_code == 401:
            raise DashlyAPIError(
                f"Login rejected for {self.email}. Check DASHLY_EMAIL and DASHLY_PASSWORD."
            )
        if resp.status_code != 200:
            raise DashlyAPIError(f"Login failed ({resp.status_code}): {resp.text[:300]}")
        try:
            body = resp.json()
        except ValueError as err:
            raise DashlyAPIError(f"Login returned non-JSON response: {resp.text[:300]}") from err
        token = body.get("token")
        if not token:
            raise DashlyAPIError(f"Login response missing 'token' field: {body}")
        self._token = token
        return token

    def _headers(self) -> dict[str, str]:
        if not self._token:
            self.login()
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, json_body: Optional[dict] = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            resp = self._client.request(
                method, url, headers=self._headers(), json=json_body
            )
        except httpx.RequestError as err:
            raise DashlyAPIError(f"Network error on {method} {path}: {err}") from err
        # If token expired, try once more after re-login. If re-login fails
        # (bad credentials), surface that as the auth error rather than a retry failure.
        if resp.status_code == 401:
            self.login()  # raises DashlyAPIError on bad creds
            try:
                resp = self._client.request(
                    method, url, headers=self._headers(), json=json_body
                )
            except httpx.RequestError as err:
                raise DashlyAPIError(f"Network error on retry {method} {path}: {err}") from err
        try:
            body = resp.json()
        except ValueError:
            raise DashlyAPIError(
                f"Non-JSON response from {path} ({resp.status_code}): {resp.text[:300]}"
            )
        if resp.status_code >= 400:
            raise DashlyAPIError(f"{method} {path} failed ({resp.status_code}): {body}")
        return body

    def get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def post(self, path: str, body: dict) -> dict[str, Any]:
        return self._request("POST", path, json_body=body)

    def close(self) -> None:
        self._client.close()
