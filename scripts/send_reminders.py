#!/usr/bin/env python3
"""
Daily birthday reminder sender.

- Runs once per day (via GitHub Actions)
- Uses America/Chicago timezone to determine "today"
- Queries Supabase for matching birthdays
- Sends Discord DMs
- Logs sends to prevent duplicates
"""

import os
import sys
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

# ----------------------------
# Environment + configuration
# ----------------------------

DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

DISCORD_API_BASE = "https://discord.com/api/v10"
TIMEZONE = ZoneInfo("America/Chicago")

# Simple exit helper

def die(message: str, code: int = 1) -> None:
    print(f"ERROR: {message}")
    sys.exit(code)

# Validate required environment variables
if not DISCORD_BOT_TOKEN:
    die("DISCORD_BOT_TOKEN is required")
if not SUPABASE_URL:
    die("SUPABASE_URL is required")
if not SUPABASE_SERVICE_ROLE_KEY:
    die("SUPABASE_SERVICE_ROLE_KEY is required")

# ----------------------------
# Supabase helpers (PostgREST)
# ----------------------------

def supabase_headers() -> dict:
    # Service role key is used only from GitHub Actions secrets
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def supabase_get(path: str, params: dict) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    r = requests.get(url, headers=supabase_headers(), params=params, timeout=20)
    if not r.ok:
        die(f"Supabase GET failed: {r.status_code} {r.text}")
    return r.json()


def supabase_post(path: str, json_body: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = supabase_headers()
    # Upsert-friendly preference in case of retries
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"

    r = requests.post(url, headers=headers, json=json_body, timeout=20)
    if not r.ok:
        die(f"Supabase POST failed: {r.status_code} {r.text}")

# ----------------------------
# Discord helpers
# ----------------------------

def discord_headers() -> dict:
    return {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
        "Content-Type": "application/json",
    }


def discord_create_dm_channel(user_id: str) -> str:
    # Create (or fetch) a DM channel with the recipient
    url = f"{DISCORD_API_BASE}/users/@me/channels"
    payload = {"recipient_id": user_id}
    r = requests.post(url, headers=discord_headers(), json=payload, timeout=20)
    if not r.ok:
        die(f"Discord DM channel creation failed: {r.status_code} {r.text}")
    return r.json()["id"]


def discord_send_message(channel_id: str, content: str) -> None:
    url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages"
    payload = {"content": content}
    r = requests.post(url, headers=discord_headers(), json=payload, timeout=20)
    if not r.ok:
        die(f"Discord message send failed: {r.status_code} {r.text}")

# ----------------------------
# Main job logic
# ----------------------------

def main() -> None:
    # Compute today's date in America/Chicago
    today = datetime.now(TIMEZONE).date()
    month = today.month
    day = today.day
    mmdd = today.strftime("%m/%d")
    yyyymmdd = today.strftime("%Y%m%d")

    # Fetch today's birthdays
    birthdays = supabase_get(
        "birthdays",
        {
            "select": "owner_user_id,name,month,day",
            "month": f"eq.{month}",
            "day": f"eq.{day}",
        },
    )

    if not birthdays:
        print("No birthdays today.")
        return

    # Group names by owner_user_id
    grouped = defaultdict(list)
    for row in birthdays:
        grouped[str(row["owner_user_id"])].append(row["name"])

    # Send DMs once per owner_user_id and log sends
    for owner_user_id, names in grouped.items():
        # Skip if already sent today
        sent = supabase_get(
            "sent_log",
            {
                "select": "owner_user_id,yyyymmdd",
                "owner_user_id": f"eq.{owner_user_id}",
                "yyyymmdd": f"eq.{yyyymmdd}",
            },
        )
        if sent:
            print(f"Already sent to {owner_user_id} for {yyyymmdd}. Skipping.")
            continue

        # Create DM channel and send the message
        channel_id = discord_create_dm_channel(owner_user_id)
        names_str = ", ".join(sorted(names))
        message = f"🎉 Today ({mmdd}) is: {names_str}"
        discord_send_message(channel_id, message)

        # Log send to prevent duplicates
        supabase_post(
            "sent_log",
            {"owner_user_id": int(owner_user_id), "yyyymmdd": yyyymmdd},
        )

        print(f"Sent reminder to {owner_user_id}: {message}")


if __name__ == "__main__":
    main()
