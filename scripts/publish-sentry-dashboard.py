"""Publish the fixed YRDLY monitoring dashboard using CI's protected token."""

import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://us.sentry.io/api/0/organizations/yrdly-ltd/dashboards/"


def main():
    token = os.environ.get("SENTRY_AUTH_TOKEN", "").strip()
    if not token:
        raise RuntimeError("SENTRY_AUTH_TOKEN is not configured")
    payload = json.loads(Path(__file__).with_name("sentry-dashboard.json").read_text())
    if payload.get("title") != "YRDLY Web and Mobile Health":
        raise RuntimeError("Unexpected dashboard title")

    def request(url, body=None):
        if not url.startswith(BASE):
            raise RuntimeError("Unexpected Sentry endpoint")
        req = Request(url, data=json.dumps(body).encode() if body else None,
                      headers={"Authorization": "Bearer " + token,
                               "Content-Type": "application/json"},
                      method="POST" if body else "GET")
        with urlopen(req, timeout=40) as response:
            return json.load(response), response.headers.get("Link", "")

    existing = None
    next_url = BASE
    # Read all pages before creating so retries never duplicate a saved dashboard.
    for _ in range(20):
        dashboards, links = request(next_url)
        if not isinstance(dashboards, list):
            raise RuntimeError("Unexpected dashboard list response")
        matches = [d for d in dashboards if d.get("title") == payload["title"]]
        if matches:
            existing = matches[0]
            break
        next_link = next((part for part in links.split(",")
                          if 'rel="next"' in part and 'results="true"' in part), None)
        if not next_link:
            break
        match = re.search(r"<([^>]+)>", next_link)
        if not match:
            raise RuntimeError("Invalid dashboard pagination")
        next_url = match.group(1)
    else:
        raise RuntimeError("Dashboard pagination limit reached; nothing was created")

    dashboard = existing or request(BASE, payload)[0]
    dashboard_id = str(dashboard.get("id", ""))
    if not dashboard_id.isdecimal():
        raise RuntimeError("Missing dashboard id")
    verified, _ = request(BASE + dashboard_id + "/")
    if verified.get("title") != payload["title"] or not verified.get("widgets"):
        raise RuntimeError("Saved dashboard verification failed")
    url = "https://yrdly-ltd.sentry.io/dashboard/" + dashboard_id + "/"
    print("Verified dashboard: " + url)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as handle:
            handle.write("[YRDLY Web and Mobile Health](" + url + ")\n\n")
            handle.write(str(len(verified["widgets"])) + " saved widgets verified.\n")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        # Report validation errors without logging credentials or response profiles.
        detail = error.read().decode("utf-8", errors="replace")[:3000]
        token = os.environ.get("SENTRY_AUTH_TOKEN", "")
        if token:
            detail = detail.replace(token, "[redacted]")
        print("Sentry HTTP " + str(error.code) + ": " + detail, file=sys.stderr)
        sys.exit(1)
