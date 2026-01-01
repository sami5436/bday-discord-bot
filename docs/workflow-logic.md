# Workflow Logic

This is the end-to-end flow for the birthday reminder system.

## Slash Command Flow

1. User runs `/add`, `/list`, or `/remove` in a DM with the bot.
2. Discord sends an interaction payload to the Cloudflare Worker endpoint.
3. The worker verifies the signature and parses the command.
4. The worker uses Supabase (PostgREST) to store or query birthdays.
5. The worker returns a JSON response that Discord displays to the user.

## Daily Reminder Flow

1. A scheduled GitHub Action runs `scripts/send_reminders.py` once per day.
2. The script computes "today" in America/Chicago.
3. It queries Supabase for birthdays matching today’s month/day.
4. It groups results by Discord user and sends one DM per user.
5. It writes to `sent_log` so the same user isn't notified twice in a day.

## Data Model

- `birthdays`: `owner_user_id`, `name`, `month`, `day`
- `sent_log`: `owner_user_id`, `yyyymmdd`

The primary keys prevent duplicates and allow upserts.
