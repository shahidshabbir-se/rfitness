# Gym Check-in System

A modern web application for gym member check-in with Square API integration. This system allows gym staff to verify memberships, process check-ins, and manage member data through a clean, intuitive interface.

![Gym Check-in System](public/logo-light.png)

## Project Overview

The Gym Check-in System is designed to streamline the check-in process for gym members by integrating with Square's payment and customer management systems. It verifies membership status based on subscription data or recent payments in Square, logs check-ins, and provides administrative tools for gym staff.

### Key Features

- **Member Check-in**: Quick verification of membership status via phone number
- **QR Code Check-in**: Support for QR code-based check-ins
- **Admin Dashboard**: Comprehensive view of gym operations including:
  - System status monitoring
  - Real-time check-in notifications
  - Check-in logs and history
  - Membership status verification
  - Analytics and reports
- **Square Integration**: Seamless connection with Square for:
  - Customer data retrieval
  - Subscription verification
  - Payment history validation
  - Webhook support for real-time updates
- **Responsive Design**: Works on tablets, desktop computers, and mobile devices

## Installation Instructions

### Prerequisites

- Node.js (v20.x or later)
- npm (v10.x or later)
- Square Developer Account with API credentials

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ENGENLabs/rfitness.git
   cd rfitness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables (see Configuration section below)

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

### Production Build

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

For detailed deployment instructions, see the [Deployment Guide](deployment-guide.md).

## Configuration Details

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Square API credentials
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=sandbox  # or 'production'
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key  # Optional, for webhook verification
SQUARE_LOCATION_ID=your_location_id  # Optional, for location-specific operations

# Database configuration (if using SQLite)
DATABASE_URL=file:/path/to/your/database.db

# Application settings
NODE_ENV=development  # or 'production'
PORT=3000  # Optional, defaults to 3000
```

### Square API Setup

1. Create a Square Developer account at [developer.squareup.com](https://developer.squareup.com/)
2. Create a new application
3. Navigate to the Credentials tab and copy your Access Token
4. Set the appropriate environment (sandbox for testing, production for live data)
5. For webhook support, set up a webhook endpoint in the Square Developer Dashboard

See [API.md](API.md) for detailed information on Square API integration.

## Usage Guide

### Member Check-in Process

1. Navigate to the check-in page (`/check-in`)
2. Enter the member's phone number
3. The system verifies membership status with Square
4. If valid, the check-in is recorded and a success message is displayed
5. If invalid, an appropriate error message is shown

### QR Code Check-in

1. Generate a QR code for a member from the admin dashboard
2. Member scans the QR code using their device
3. System automatically processes the check-in

### Admin Dashboard

1. Navigate to the admin page (`/admin`)
2. View system status, recent check-ins, and membership information
3. Use the tabs to access different administrative functions:
   - System Status: View Square API connection status and system health
   - Check-in Notifications: Real-time alerts for new check-ins
   - Check-in Log: Historical record of all check-ins
   - Membership Status: Verify and manage member subscriptions
   - Analytics Reports: Usage statistics and trends
   - Webhook Status: Monitor incoming webhook events from Square

## Code Structure

The project follows the Remix framework structure with some custom organization:

```
/app
  /components          # React components
    /admin             # Admin dashboard components
    /check-in          # Check-in flow components
  /routes              # Route components (pages)
    _index.tsx         # Home page
    admin.tsx          # Admin dashboard
    check-in.tsx       # Member check-in page
    qr.tsx             # QR code handling
    webhook.tsx        # Square webhook endpoint
  /types               # TypeScript type definitions
  /utils               # Utility functions
    square.server.ts   # Square API integration
    env.server.ts      # Environment configuration
    formatters.server.ts  # Data formatting utilities
    membership.server.ts  # Membership validation logic
    webhook.server.ts  # Webhook processing logic
  entry.client.tsx     # Client entry point
  entry.server.tsx     # Server entry point
  root.tsx             # Root component
  tailwind.css         # Tailwind CSS styles
/public                # Static assets
/build                 # Production build output (generated)
```

### Key Files

- **app/utils/square.server.ts**: Core integration with Square API, handles customer lookup and membership verification
- **app/utils/membership.server.ts**: Business logic for validating different types of memberships
- **app/utils/webhook.server.ts**: Processing of Square webhook events
- **app/routes/check-in.tsx**: Main check-in flow for members
- **app/routes/admin.tsx**: Admin dashboard and management interface
- **app/components/admin/AdminTabs.tsx**: Tab-based navigation for admin dashboard
- **app/components/check-in/CheckInForm.tsx**: Form for member check-in process

## Development Guidelines

### Code Style

This project uses ESLint and TypeScript for code quality. Run linting with:

```bash
npm run lint
```

Run type checking with:

```bash
npm run typecheck
```

### Adding New Features

1. For new pages, add a route file in `app/routes/`
2. For new components, add them to the appropriate folder in `app/components/`
3. For new utility functions, add them to `app/utils/`
4. Update types in `app/types/` as needed

### Testing

Currently, the project does not have automated tests. When adding tests:

1. Create a `__tests__` directory in the relevant folder
2. Name test files with the `.test.ts` or `.test.tsx` extension
3. Run tests with `npm test` (once implemented)

## Troubleshooting

### Common Issues

- **Square API Connection Errors**: Verify your access token and environment settings
- **Check-in Verification Failures**: Ensure the phone number format matches what's in Square
- **Webhook Processing Issues**: Check the webhook signature key and endpoint configuration

### Debugging

- Check the server logs for error messages
- Use the System Status tab in the admin dashboard to verify Square API connectivity
- For local development, use the Network tab in browser DevTools to inspect API requests

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Contact

For support or inquiries, please contact [your-email@example.com](mailto:your-email@example.com).
