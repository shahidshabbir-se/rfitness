# Real-Time Check-in Notifications via SSE

This pull request implements real-time check-in notifications for the admin dashboard using Server-Sent Events (SSE). The implementation ensures notifications work in production environments while preserving the existing styling and behavior.

## Changes Made

### Server-Side Changes
- Added SSE endpoint in `entry.server.tsx` to handle real-time events
- Created `check-in.server.ts` utility to process check-ins and emit events
- Updated webhook handling to trigger notifications for check-in events
- Added environment variable support for controlling the feature

### Client-Side Changes
- Updated `admin.tsx` to establish SSE connection and receive notifications
- Preserved existing notification styling and 10-second auto-hide behavior
- Made simulated check-ins conditional (only in development/sandbox)

### Configuration
- Added `ENABLE_REAL_TIME_NOTIFICATIONS` environment variable
- Updated `.env.example` with the new variable
- Added documentation in `README.md` for the new feature

## How It Works

1. When a member checks in (via phone number), the system verifies their membership with Square API:
   - Checks for valid subscription in Square
   - OR checks for a £30 transaction (cash or card) in the last 30 days

2. After verification, the check-in is processed and an event is emitted

3. The admin dashboard receives this event via SSE and displays a notification:
   - Shows customer name, status, and timestamp
   - Uses green styling for successful check-ins, red for failed ones
   - Auto-shows when received and auto-hides after 10 seconds

## Testing Instructions

1. Set `ENABLE_REAL_TIME_NOTIFICATIONS=true` in your `.env` file
2. Start the application in production mode
3. Open two browser windows:
   - One with the admin dashboard (`/admin`)
   - One with the check-in page (`/check-in`)
4. Perform a check-in and observe the real-time notification in the admin dashboard

## Benefits

- Administrators see check-ins in real-time without refreshing the page
- Works with all types of membership verification (subscription or transaction)
- Lightweight implementation using SSE instead of WebSockets
- Configurable via environment variables
- Preserves existing UI/UX 