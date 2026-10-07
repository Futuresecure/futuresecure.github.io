# Google Calendar appointment rescheduling

Production project: `cjwxirpwzluynymwjzxl` (`future-secure-providers-crm`).

## Connection

Google Calendar API must be enabled in the Google Cloud project. Use a Web OAuth client with this exact redirect URI:

`https://cjwxirpwzluynymwjzxl.supabase.co/functions/v1/google-calendar-oauth/callback`

Edge Function secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Never put the client secret or a refresh token in GitHub or browser storage. The administrator connects from CRM → Calendar → Connect Google Calendar, selecting the account owning the existing events. External OAuth apps in Testing issue Calendar refresh tokens that expire after seven days; set the app's audience publishing status to Production for ongoing use, satisfying any Google verification requirements. Revoked or expired grants still require reconnecting.

## Behavior

- The existing appointment is updated by ID. The database trigger queues changes to date, time or linked event/calendar ID.
- Every minute, Cron invokes an authenticated Edge worker; one leased job is processed at a time. Transient errors use backoff; after eight failed attempts the admin can retry.
- The worker GETs the stored event, preserves its duration and PATCHes only start/end with an ETag condition. It never creates a new event, changes the stored event ID, or sends attendee update emails. Times use Asia/Kolkata.
- Empty calendar IDs mean the connected account's primary calendar. For secondary calendars, set `appointments.google_calendar_id` to the actual calendar ID. Unlinked appointments are not synced. Cancelled, all-day and recurring events require manual review.
- Calendar connection, OAuth state and job tables are service-role-only. The refresh token and PKCE verifier are encrypted with AES-GCM using a key derived from the client secret. Rotating the client secret requires reconnecting.
- OAuth start/status/retry validate the CRM JWT against Auth and require the configured administrator UUID. The callback uses a short-lived, single-use state and PKCE. The worker uses a random credential in Vault. The function has gateway JWT verification disabled because it implements route-specific authentication and Google's callback cannot supply a CRM JWT.
- Main website and WhatsApp functions are unchanged. No customer appointment was permanently modified during deployment verification.

## Source and verification

`sql/google-calendar.sql` is the additive SQL applied using migration name `google_calendar_reschedule_backend`. Do not reapply it to the same database.

The Edge entry point is `functions/google-calendar-oauth/index.ts`. Deploy as `google-calendar-oauth`. The public `/health` endpoint returns only readiness booleans, never secret values.

From repository root:

```
node tests/appointment-reschedule.test.cjs
node tests/google-calendar.test.cjs
```

Production checks included denied anonymous start/worker requests, invalid OAuth state, SQL queue coalescing in a rolled-back transaction, and denied browser-role access to credentials. Actual Google refresh and event update verification requires the owner's Google consent first.
