# Database Implementation Guide

This guide provides detailed information about the database implementation in the R-Fitness Gym Check-in System.

## Overview

The application uses Prisma ORM with PostgreSQL for data persistence. In development, it uses SQLite for simplicity, while in production it connects to a PostgreSQL database.

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes the following models:

### User Model

Represents admin users who can access the dashboard.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Customer Model

Represents gym members who can check in.

```prisma
model Customer {
  id          String    @id @default(cuid())
  squareId    String?   @unique
  phoneNumber String    @unique
  firstName   String
  lastName    String
  email       String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  checkIns    CheckIn[]
}
```

### CheckIn Model

Records each time a customer checks in to the gym.

```prisma
model CheckIn {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
  timestamp  DateTime @default(now())
  verified   Boolean  @default(false)
  verifiedBy String?
}
```

### Configuration Model

Stores application configuration settings.

```prisma
model Configuration {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### SystemLog Model

Records system events, errors, and activities.

```prisma
model SystemLog {
  id        String   @id @default(cuid())
  timestamp DateTime @default(now())
  message   String
  eventType String
  severity  String
  details   Json?
}
```

## Database Operations

The application implements CRUD operations for each model in dedicated server modules:

### User Operations (`app/models/user.server.ts`)

- `createUser`: Creates a new admin user
- `getUserById`: Retrieves a user by ID
- `getUserByEmail`: Retrieves a user by email
- `verifyLogin`: Verifies user credentials

### Customer Operations (`app/models/customer.server.ts`)

- `createCustomer`: Creates a new customer record
- `getCustomerById`: Retrieves a customer by ID
- `getCustomerByPhoneNumber`: Retrieves a customer by phone number
- `getCustomers`: Retrieves a paginated list of customers
- `updateCustomer`: Updates customer information
- `deleteCustomer`: Deletes a customer record
- `getCustomerStats`: Retrieves statistics about customers

### CheckIn Operations (`app/models/check-in.server.ts`)

- `createCheckIn`: Records a new check-in
- `getRecentCheckIns`: Retrieves recent check-ins with pagination
- `getCheckInsByCustomerId`: Retrieves check-ins for a specific customer
- `getCheckInsByDateRange`: Retrieves check-ins within a date range
- `getCheckInStats`: Retrieves statistics about check-ins
- `deleteCheckIn`: Deletes a check-in record

### SystemLog Operations (`app/models/system-log.server.ts`)

- `createSystemLog`: Creates a new system log entry
- `getSystemLogs`: Retrieves system logs with filtering and pagination
- `deleteSystemLog`: Deletes a system log entry

### Configuration Operations (`app/models/configuration.server.ts`)

- `getConfiguration`: Retrieves a configuration value by key
- `setConfiguration`: Sets a configuration value
- `deleteConfiguration`: Deletes a configuration entry

## Data Flow

### Check-in Process

1. User enters phone number on the check-in page
2. System verifies the phone number against the Customer database
3. If the customer exists and is active:
   - System creates a new CheckIn record
   - System logs the successful check-in to SystemLog
4. If verification fails:
   - System logs the failed check-in attempt to SystemLog

### Admin Dashboard

The admin dashboard displays real-time data from the database:

- Recent check-ins from the CheckIn model
- Member information from the Customer model
- System logs from the SystemLog model
- Analytics data aggregated from CheckIn and Customer models

### Webhook Handling

When webhooks are received from Square:

1. System validates the webhook signature
2. System logs the webhook event to SystemLog
3. Based on the event type:
   - Customer events update the Customer model
   - Subscription events update membership status

### System Logging

The application logs various events to the SystemLog model:

- System startup and configuration
- Check-in attempts (successful and failed)
- API errors and connection issues
- Webhook events
- User authentication events

## Environment-Specific Behavior

### Development Environment

- Uses SQLite database for simplicity
- Can use mock data for testing
- Logs detailed error information

### Production Environment

- Uses PostgreSQL database for reliability and scalability
- Connects using environment variables for credentials
- Implements more strict error handling
- Logs errors but hides sensitive details

## Database Migrations

Database migrations are managed through Prisma:

1. Changes to the schema are made in `prisma/schema.prisma`
2. Migrations are generated with `npx prisma migrate dev`
3. In production, migrations are applied with `npx prisma migrate deploy`

## Backup and Recovery

For production deployments:

1. Regular database backups are configured through Docker volumes
2. The PostgreSQL container includes health checks
3. Data persistence is ensured through named volumes

## Monitoring and Performance

The application includes:

1. System logs for tracking errors and events
2. Check-in statistics for monitoring usage
3. Customer statistics for membership tracking

## Security Considerations

1. Passwords are hashed before storage
2. Database credentials are stored as environment variables
3. SQL injection is prevented through Prisma's query building
4. Access to the admin dashboard requires authentication

