# Python Reminder Script

The daily reminder job is implemented in `scripts/send_reminders.py` and is run by GitHub Actions on a schedule.

## Responsibilities

- Load environment variables for Discord and Supabase
- Compute “today” in America/Chicago
- Query Supabase for birthdays matching today’s month/day
- Group birthdays by Discord user
- Send one DM per user with their list of birthdays
- Write a log entry to avoid duplicates

## Why the Log Exists

`sent_log` ensures a user receives at most one message per day even if the job retries or the workflow is re-run.

## Environment Variables

- `DISCORD_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
