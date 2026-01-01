# Worker: `worker/index.ts`

This file implements the Discord interactions endpoint.

## What It Does

- Accepts only `POST` requests
- Verifies the request signature using Discord’s Ed25519 public key
- Handles PING interactions (returns PONG)
- Handles slash commands:
  - `/add` — store a birthday in Supabase
  - `/list` — list birthdays for the user
  - `/remove` — delete a birthday for the user
- Rejects usage in servers (DM-only)

## Validation Rules

- Birthday format: `MM/DD`
- Month/day bounds are validated (Feb allows 29)
- Name length is capped at 100 characters

## Supabase Access

The Worker uses the Supabase REST API:

- `POST /rest/v1/birthdays` with upsert behavior
- `GET /rest/v1/birthdays` for listing
- `DELETE /rest/v1/birthdays` for removal

The service role key is used in headers for these requests.
