# Gym Check-in System: Database Implementation Guide

This guide provides detailed instructions for implementing PostgreSQL database functionality in the Gym Check-in System. It's intended for developers who will be adding persistent storage capabilities to the application after the production environment has been set up.

## Table of Contents

1. [Overview](#overview)
2. [Database Connection Setup](#database-connection-setup)
3. [Models and Schemas](#models-and-schemas)
4. [Required Database Operations](#required-database-operations)
5. [Files to Modify](#files-to-modify)
6. [New Files to Create](#new-files-to-create)
7. [Implementation Steps](#implementation-steps)
8. [Testing](#testing)
9. [Deployment Considerations](#deployment-considerations)

## Overview

The Gym Check-in System currently relies on Square API for customer and membership data, with temporary in-memory storage for system state. This implementation will add PostgreSQL for persistent storage of:

- Check-in records
- User accounts (admin/staff)
- System logs
- Configuration settings

The database schema has already been defined in the deployment guide, and the PostgreSQL server setup is included in the production environment instructions.

## Database Connection Setup

### 1. Create Database Client Utility

First, create a database client utility that will manage the connection to PostgreSQL:

```typescript
// app/utils/db.server.ts
import { Pool } from 'pg';
import { getEnv } from './env.server';

let pool: Pool | null = null;

export function getDbPool() {
  if (!pool) {
    const env = getEnv();
    
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test the connection
    pool.query('SELECT NOW()', (err) => {
      if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        pool = null;
      } else {
        console.log('Successfully connected to PostgreSQL');
      }
    });
  }
  
  return pool;
}

export async function query(text: string, params: any[] = []) {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Close the pool when the application shuts down
process.on('SIGTERM', () => {
  if (pool) {
    pool.end();
  }
});
```

### 2. Update Environment Configuration

Ensure the environment utility can access the database URL:

```typescript
// app/utils/env.server.ts (modify existing file)
export function getEnv() {
  return {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://gym_user:your_secure_password@localhost:5432/gym_checkin',
  };
}

// Add a function to check if database is configured
export function isDatabaseConfigured() {
  const env = getEnv();
  return Boolean(env.DATABASE_URL && env.DATABASE_URL.length > 0);
}
```

## Models and Schemas

Create TypeScript interfaces for each database entity and corresponding data access objects.

### 1. Define Types

```typescript
// app/types/index.ts (add to existing file)

// Database Models
export interface User {
  id: number;
  username: string;
  passwordHash: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt: Date;
  lastLogin: Date | null;
}

export interface CheckIn {
  id: number;
  customerId: string;
  customerName: string | null;
  phoneNumber: string | null;
  checkInTime: Date;
  membershipType: string | null;
  locationId: string | null;
  verifiedBy: string | null;
}

export interface SystemLog {
  id: number;
  timestamp: Date;
  eventType: string;
  message: string;
  details: any;
  severity: 'info' | 'warning' | 'error';
}

export interface Configuration {
  key: string;
  value: any;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}
```

## Required Database Operations

Implement the following CRUD operations for each entity:

### 1. Users

```typescript
// app/models/user.server.ts
import { query } from '~/utils/db.server';
import type { User } from '~/types';
import bcrypt from 'bcryptjs';

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createUser(user: Omit<User, 'id' | 'createdAt' | 'lastLogin'>): Promise<User> {
  const hashedPassword = await bcrypt.hash(user.passwordHash, 10);
  
  const result = await query(
    `INSERT INTO users (username, password_hash, email, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user.username, hashedPassword, user.email, user.role]
  );
  
  return result.rows[0];
}

export async function updateLastLogin(username: string): Promise<void> {
  await query(
    `UPDATE users SET last_login = CURRENT_TIMESTAMP
     WHERE username = $1`,
    [username]
  );
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function getAllUsers(): Promise<User[]> {
  const result = await query('SELECT * FROM users ORDER BY username');
  return result.rows;
}
```

### 2. Check-ins

```typescript
// app/models/check-in.server.ts
import { query } from '~/utils/db.server';
import type { CheckIn } from '~/types';

export async function createCheckIn(checkIn: Omit<CheckIn, 'id'>): Promise<CheckIn> {
  const result = await query(
    `INSERT INTO check_ins (customer_id, customer_name, phone_number, check_in_time, membership_type, location_id, verified_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      checkIn.customerId,
      checkIn.customerName,
      checkIn.phoneNumber,
      checkIn.checkInTime,
      checkIn.membershipType,
      checkIn.locationId,
      checkIn.verifiedBy
    ]
  );
  
  return result.rows[0];
}

export async function getRecentCheckIns(limit: number = 50): Promise<CheckIn[]> {
  const result = await query(
    `SELECT * FROM check_ins
     ORDER BY check_in_time DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows;
}

export async function getCheckInsByCustomerId(customerId: string): Promise<CheckIn[]> {
  const result = await query(
    `SELECT * FROM check_ins
     WHERE customer_id = $1
     ORDER BY check_in_time DESC`,
    [customerId]
  );
  
  return result.rows;
}

export async function getCheckInsByDateRange(startDate: Date, endDate: Date): Promise<CheckIn[]> {
  const result = await query(
    `SELECT * FROM check_ins
     WHERE check_in_time BETWEEN $1 AND $2
     ORDER BY check_in_time DESC`,
    [startDate, endDate]
  );
  
  return result.rows;
}

export async function getCheckInsCount(): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM check_ins');
  return parseInt(result.rows[0].count);
}

export async function getCheckInsCountByDate(date: Date): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await query(
    `SELECT COUNT(*) as count FROM check_ins
     WHERE check_in_time BETWEEN $1 AND $2`,
    [startOfDay, endOfDay]
  );
  
  return parseInt(result.rows[0].count);
}
```

### 3. System Logs

```typescript
// app/models/system-log.server.ts
import { query } from '~/utils/db.server';
import type { SystemLog } from '~/types';

export async function createSystemLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog> {
  const result = await query(
    `INSERT INTO system_logs (event_type, message, details, severity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [log.eventType, log.message, log.details, log.severity]
  );
  
  return result.rows[0];
}

export async function getRecentSystemLogs(limit: number = 100): Promise<SystemLog[]> {
  const result = await query(
    `SELECT * FROM system_logs
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows;
}

export async function getSystemLogsByType(eventType: string, limit: number = 50): Promise<SystemLog[]> {
  const result = await query(
    `SELECT * FROM system_logs
     WHERE event_type = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [eventType, limit]
  );
  
  return result.rows;
}

export async function getSystemLogsBySeverity(severity: string, limit: number = 50): Promise<SystemLog[]> {
  const result = await query(
    `SELECT * FROM system_logs
     WHERE severity = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [severity, limit]
  );
  
  return result.rows;
}
```

### 4. Configuration

```typescript
// app/models/configuration.server.ts
import { query } from '~/utils/db.server';
import type { Configuration } from '~/types';

export async function getConfiguration(key: string): Promise<any> {
  const result = await query(
    'SELECT value FROM configuration WHERE key = $1',
    [key]
  );
  
  return result.rows.length > 0 ? result.rows[0].value : null;
}

export async function setConfiguration(key: string, value: any, description: string | null = null, updatedBy: string | null = null): Promise<void> {
  await query(
    `INSERT INTO configuration (key, value, description, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE
     SET value = $2, description = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP`,
    [key, value, description, updatedBy]
  );
}

export async function getAllConfigurations(): Promise<Configuration[]> {
  const result = await query('SELECT * FROM configuration ORDER BY key');
  return result.rows;
}

export async function deleteConfiguration(key: string): Promise<void> {
  await query('DELETE FROM configuration WHERE key = $1', [key]);
}
```

## Files to Modify

### 1. Update Square Utility to Log Check-ins to Database

```typescript
// app/utils/square.server.ts (modify existing file)
import { Client, Environment } from 'square';
import type { SquareConfig, CheckInResult } from '~/types';
import { formatCustomerData } from './formatters.server';
import { validateSubscription, validateCashPayment } from './membership.server';
import { getEnv, isDatabaseConfigured } from './env.server';
import { triggerWebhook } from './webhook.server';
import { getSystemStatus } from './system.server';
import { createCheckIn } from '~/models/check-in.server'; // Add this import
import { createSystemLog } from '~/models/system-log.server'; // Add this import

// ... existing code ...

export async function verifyMembership(phoneNumber: string, verifiedBy: string | null = null): Promise<CheckInResult> {
  try {
    // ... existing code ...

    // When a successful check-in occurs, add this code:
    if (result.success) {
      // Log successful check-in via webhook (existing code)
      triggerWebhook('check-in', {
        customerId: customer.id,
        customerName: `${customer.givenName || ''} ${customer.familyName || ''}`.trim(),
        phoneNumber,
        checkInTime: new Date().toISOString(),
        membershipType: 'subscription' // or 'cash' depending on the case
      }).catch(err => console.error('Failed to trigger webhook:', err));
      
      // Add database logging if database is configured
      if (isDatabaseConfigured()) {
        try {
          await createCheckIn({
            customerId: customer.id!,
            customerName: `${customer.givenName || ''} ${customer.familyName || ''}`.trim(),
            phoneNumber,
            checkInTime: new Date(),
            membershipType: 'subscription', // or 'cash' depending on the case
            locationId: getEnv().SQUARE_LOCATION_ID,
            verifiedBy
          });
        } catch (dbError) {
          console.error('Failed to log check-in to database:', dbError);
          // Log the error but don't fail the check-in
          if (isDatabaseConfigured()) {
            createSystemLog({
              eventType: 'database_error',
              message: 'Failed to log check-in to database',
              details: { error: dbError instanceof Error ? dbError.message : 'Unknown error', customerId: customer.id },
              severity: 'error'
            }).catch(e => console.error('Failed to log system error:', e));
          }
        }
      }
    }
    
    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
    
    // Add error logging to database
    if (isDatabaseConfigured()) {
      createSystemLog({
        eventType: 'api_error',
        message: 'Error verifying membership',
        details: { error: error instanceof Error ? error.message : 'Unknown error', phoneNumber },
        severity: 'error'
      }).catch(e => console.error('Failed to log system error:', e));
    }
    
    // ... rest of existing error handling ...
  }
}

// ... rest of existing code ...
```

### 2. Update System Status Utility

```typescript
// app/utils/system.server.ts (modify existing file)
import { isDatabaseConfigured } from './env.server';
import { query } from './db.server';
import { createSystemLog } from '~/models/system-log.server';

// ... existing code ...

export function getSystemStatus() {
  // ... existing code ...
  
  // Add database status check
  if (isDatabaseConfigured()) {
    try {
      // Test database connection
      query('SELECT 1')
        .then(() => {
          systemStatus.databaseStatus = 'connected';
        })
        .catch(error => {
          systemStatus.databaseStatus = 'error';
          systemStatus.lastError = {
            timestamp: new Date().toISOString(),
            message: error instanceof Error ? error.message : 'Unknown database error'
          };
          
          // Log the error to the database if possible
          createSystemLog({
            eventType: 'database_error',
            message: 'Database connection test failed',
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
            severity: 'error'
          }).catch(() => {
            // If we can't log to the database, there's not much we can do
            console.error('Failed to log database error to database (connection issue)');
          });
        });
    } catch (error) {
      systemStatus.databaseStatus = 'error';
      // ... handle error ...
    }
  } else {
    systemStatus.databaseStatus = 'not_configured';
  }
  
  return systemStatus;
}

// ... rest of existing code ...
```

### 3. Update Session Utility for User Authentication

```typescript
// app/utils/session.server.ts (modify existing file)
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import { getUserByUsername, verifyPassword, updateLastLogin } from '~/models/user.server';
import { isDatabaseConfigured } from './env.server';

// ... existing code ...

export async function login(username: string, password: string) {
  // If database is not configured, use hardcoded admin credentials for development
  if (!isDatabaseConfigured()) {
    if (username === 'admin' && password === 'admin123') {
      return { id: '1', username: 'admin', role: 'admin' };
    }
    return null;
  }
  
  // Otherwise, use database authentication
  const user = await getUserByUsername(username);
  if (!user) return null;
  
  const isValid = await verifyPassword(user, password);
  if (!isValid) return null;
  
  // Update last login time
  await updateLastLogin(username);
  
  return { id: user.id.toString(), username: user.username, role: user.role };
}

// ... rest of existing code ...
```

### 4. Update Admin Components to Use Database Data

```typescript
// app/components/admin/CheckInLog.tsx (modify existing file)
import { useState, useEffect } from 'react';
import { useLoaderData } from '@remix-run/react';
import type { CheckIn } from '~/types';

export default function CheckInLog() {
  const { checkIns } = useLoaderData<{ checkIns: CheckIn[] }>();
  
  // ... existing component code, updated to use the checkIns data ...
}
```

### 5. Update Admin Route to Load Database Data

```typescript
// app/routes/admin.tsx (modify existing file)
import { json } from '@remix-run/node';
import type { LoaderFunction } from '@remix-run/node';
import { getRecentCheckIns } from '~/models/check-in.server';
import { getRecentSystemLogs } from '~/models/system-log.server';
import { getAllConfigurations } from '~/models/configuration.server';
import { isDatabaseConfigured } from '~/utils/env.server';
import { requireUser } from '~/utils/session.server';

export const loader: LoaderFunction = async ({ request }) => {
  // Ensure user is authenticated
  await requireUser(request);
  
  let checkIns = [];
  let systemLogs = [];
  let configurations = [];
  
  // Load data from database if configured
  if (isDatabaseConfigured()) {
    try {
      checkIns = await getRecentCheckIns(50);
      systemLogs = await getRecentSystemLogs(50);
      configurations = await getAllConfigurations();
    } catch (error) {
      console.error('Error loading data from database:', error);
    }
  }
  
  return json({
    checkIns,
    systemLogs,
    configurations,
    isDatabaseConfigured: isDatabaseConfigured()
  });
};

// ... rest of existing code ...
```

## New Files to Create

### 1. Database Migration Script

```typescript
// scripts/init-db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'staff',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);
    
    // Create check_ins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255),
        phone_number VARCHAR(20),
        check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        membership_type VARCHAR(50),
        location_id VARCHAR(100),
        verified_by VARCHAR(50) REFERENCES users(username)
      )
    `);
    
    // Create system_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        event_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        severity VARCHAR(20) DEFAULT 'info'
      )
    `);
    
    // Create configuration table
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(50) REFERENCES users(username)
      )
    `);
    
    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_check_ins_customer_id ON check_ins(customer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_check_ins_check_in_time ON check_ins(check_in_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type)');
    
    // Create initial admin user if it doesn't exist
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, password_hash, email, role)
      VALUES ('admin', $1, 'admin@example.com', 'admin')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    
    // Add some initial configuration
    await client.query(`
      INSERT INTO configuration (key, value, description)
      VALUES 
        ('system_name', '"Gym Check-in System"', 'Name of the system'),
        ('check_in_notification_enabled', 'true', 'Whether to show check-in notifications'),
        ('webhook_notification_enabled', 'true', 'Whether to send webhook notifications')
      ON CONFLICT (key) DO NOTHING
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database initialized successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase().catch(console.error);
```

### 2. Database Utility for Transactions

```typescript
// app/utils/db-transaction.server.ts
import { Pool, PoolClient } from 'pg';
import { getDbPool } from './db.server';

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3. Database Status Component

```typescript
// app/components/admin/DatabaseStatus.tsx
import React from 'react';
import { useLoaderData } from '@remix-run/react';

export default function DatabaseStatus() {
  const { isDatabaseConfigured, databaseStatus } = useLoaderData<{
    isDatabaseConfigured: boolean;
    databaseStatus: string;
  }>();
  
  if (!isDatabaseConfigured) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Database is not configured. Check-ins and system logs are not being saved.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (databaseStatus === 'error') {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              Database connection error. Check-ins and system logs may not be saved.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-700">
            Database connected. Check-ins and system logs are being saved.
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Implementation Steps

Follow these steps to implement the database functionality:

1. **Install Required Dependencies**

   ```bash
   npm install pg bcryptjs
   npm install --save-dev @types/pg @types/bcryptjs
   ```

2. **Create Database Utility Files**

   - Create `app/utils/db.server.ts` for database connection
   - Create `app/utils/db-transaction.server.ts` for transaction support

3. **Update Environment Configuration**

   - Modify `app/utils/env.server.ts` to include database URL
   - Add `isDatabaseConfigured()` function

4. **Create Model Files**

   - Create `app/models/user.server.ts`
   - Create `app/models/check-in.server.ts`
   - Create `app/models/system-log.server.ts`
   - Create `app/models/configuration.server.ts`

5. **Update Type Definitions**

   - Add database model interfaces to `app/types/index.ts`

6. **Modify Existing Files**

   - Update `app/utils/square.server.ts` to log check-ins to database
   - Update `app/utils/system.server.ts` to check database status
   - Update `app/utils/session.server.ts` for database authentication

7. **Create Database Status Component**

   - Create `app/components/admin/DatabaseStatus.tsx`
   - Add it to the admin dashboard

8. **Update Admin Routes**

   - Modify `app/routes/admin.tsx` to load data from database
   - Update admin components to use database data

9. **Create Database Initialization Script**

   - Create `scripts/init-db.ts` for database setup
   - Add script to `package.json`: `"init-db": "ts-node scripts/init-db.ts"`

10.10. **Test Database Functionality**

   - Run the database initialization script
   - Test each database operation
   - Verify data persistence across application restarts

11. **Update Check-in Flow**

   - Modify `app/routes/check-in.tsx` to pass the verified user to the database
   - Update webhook handling to log events to the database

## Testing

### 1. Database Connection Testing

Create a simple test script to verify database connectivity:

```typescript
// scripts/test-db-connection.ts
import { getDbPool } from '../app/utils/db.server';

async function testConnection() {
  const pool = getDbPool();
  if (!pool) {
    console.error('Failed to get database pool');
    process.exit(1);
  }
  
  try {
    const result = await pool.query('SELECT NOW() as time');
    console.log('Database connection successful!');
    console.log('Current database time:', result.rows[0].time);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
```

### 2. Model Testing

Test each model's CRUD operations:

```typescript
// scripts/test-models.ts
import { createUser, getUserByUsername } from '../app/models/user.server';
import { createCheckIn, getRecentCheckIns } from '../app/models/check-in.server';
import { createSystemLog, getRecentSystemLogs } from '../app/models/system-log.server';
import { setConfiguration, getConfiguration } from '../app/models/configuration.server';

async function testModels() {
  try {
    // Test user model
    console.log('Testing user model...');
    const testUser = {
      username: 'testuser',
      passwordHash: 'password123',
      email: 'test@example.com',
      role: 'staff' as const
    };
    
    await createUser(testUser);
    const retrievedUser = await getUserByUsername('testuser');
    console.log('User created and retrieved:', retrievedUser?.username === 'testuser');
    
    // Test check-in model
    console.log('Testing check-in model...');
    const testCheckIn = {
      customerId: 'test-customer-id',
      customerName: 'Test Customer',
      phoneNumber: '1234567890',
      checkInTime: new Date(),
      membershipType: 'test',
      locationId: 'test-location',
      verifiedBy: 'testuser'
    };
    
    await createCheckIn(testCheckIn);
    const checkIns = await getRecentCheckIns(1);
    console.log('Check-in created and retrieved:', checkIns.length > 0);
    
    // Test system log model
    console.log('Testing system log model...');
    const testLog = {
      eventType: 'test',
      message: 'Test log message',
      details: { test: true },
      severity: 'info' as const
    };
    
    await createSystemLog(testLog);
    const logs = await getRecentSystemLogs(1);
    console.log('System log created and retrieved:', logs.length > 0);
    
    // Test configuration model
    console.log('Testing configuration model...');
    await setConfiguration('test_key', { value: 'test_value' }, 'Test configuration', 'testuser');
    const config = await getConfiguration('test_key');
    console.log('Configuration created and retrieved:', config?.value === 'test_value');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testModels();
```

### 3. Integration Testing

Test the integration between Square API and database:

```typescript
// scripts/test-integration.ts
import { verifyMembership } from '../app/utils/square.server';
import { getRecentCheckIns } from '../app/models/check-in.server';

async function testIntegration() {
  try {
    // Use a known valid phone number from your Square account
    const phoneNumber = '1234567890';
    
    console.log(`Testing membership verification for ${phoneNumber}...`);
    const result = await verifyMembership(phoneNumber, 'test-user');
    console.log('Verification result:', result);
    
    if (result.success) {
      console.log('Checking if check-in was logged to database...');
      // Wait a moment for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkIns = await getRecentCheckIns(1);
      console.log('Recent check-ins:', checkIns);
      
      const found = checkIns.some(checkIn => checkIn.phoneNumber === phoneNumber);
      console.log('Check-in found in database:', found);
    }
  } catch (error) {
    console.error('Integration test failed:', error);
  }
}

testIntegration();
```

## Deployment Considerations

### 1. Database Migration

When deploying to production, ensure the database is properly initialized:

1. Run the database initialization script against your production database:
   ```bash
   NODE_ENV=production npm run init-db
   ```

2. Verify the database tables were created correctly:
   ```bash
   psql $DATABASE_URL -c "\dt"
   ```

### 2. Environment Variables

Ensure your production environment has the correct database URL:

```
DATABASE_URL=postgresql://gym_user:your_secure_password@localhost:5432/gym_checkin
```

### 3. Connection Pooling

For production environments, consider adjusting the connection pool settings:

```typescript
// app/utils/db.server.ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});
```

### 4. Error Handling and Fallbacks

Ensure the application can function even if the database is temporarily unavailable:

```typescript
// Example of robust database operation with fallback
export async function getRecentCheckIns(limit: number = 50): Promise<CheckIn[]> {
  try {
    const result = await query(
      `SELECT * FROM check_ins
       ORDER BY check_in_time DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching recent check-ins:', error);
    // Return empty array as fallback
    return [];
  }
}
```

### 5. Database Backup

Set up regular database backups as described in the deployment guide:

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d")
BACKUP_DIR="/var/backups/gym-checkin"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
export PGPASSWORD="your_secure_password"
pg_dump -h localhost -U gym_user gym_checkin > "$BACKUP_DIR/gym-$TIMESTAMP.sql"
unset PGPASSWORD

# Compress the backup
gzip "$BACKUP_DIR/gym-$TIMESTAMP.sql"

# Delete backups older than 30 days
find $BACKUP_DIR -name "gym-*.sql.gz" -mtime +30 -delete
```

## Conclusion

This implementation guide provides a comprehensive approach to adding PostgreSQL database functionality to the Gym Check-in System. By following these steps, you'll create a robust, persistent storage solution that enhances the application's reliability and functionality.

The database implementation focuses on four key areas:
1. User authentication and management
2. Check-in logging and history
3. System event logging
4. Configuration storage

This approach maintains compatibility with the existing Square API integration while adding the benefits of persistent storage. The implementation includes proper error handling, connection management, and fallback mechanisms to ensure the application remains functional even in case of temporary database issues.

After completing this implementation, the Gym Check-in System will have a fully functional database backend that stores all critical data, enhancing both the user experience and administrative capabilities.
