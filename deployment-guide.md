# Gym Check-in System Deployment Guide

This guide provides step-by-step instructions for deploying the Gym Check-in System to a Vultr server. No code changes are required.

## Table of Contents
1. [Server Provisioning](#1-server-provisioning)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Database Setup](#3-database-setup)
4. [Application Deployment](#4-application-deployment)
5. [Environment Configuration](#5-environment-configuration)
6. [Running the Application](#6-running-the-application)
7. [Setting Up Nginx as a Reverse Proxy](#7-setting-up-nginx-as-a-reverse-proxy)
8. [SSL Configuration](#8-ssl-configuration)
9. [Webhook Configuration](#9-webhook-configuration)
10. [Post-Deployment Verification](#10-post-deployment-verification)
11. [Maintenance and Monitoring](#11-maintenance-and-monitoring)

## 1. Server Provisioning

### Recommended Vultr Configuration
- **Server Type**: Cloud Compute
- **CPU & Memory**: 2 vCPU, 4GB RAM minimum
- **Storage**: 80GB SSD
- **Operating System**: Ubuntu 22.04 LTS
- **Location**: Choose a region closest to your gym's location

### Provisioning Steps
1. Create a Vultr account if you don't have one
2. Click "Deploy Server"
3. Select the configuration above
4. Set a strong root password or SSH key
5. Deploy the server and note the IP address

## 2. Initial Server Setup

SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

### Update System Packages

```bash
apt update && apt upgrade -y
```

### Create a Non-Root User

```bash
adduser gymadmin
usermod -aG sudo gymadmin
```

### Set Up Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5432/tcp  # PostgreSQL (only if remote access is needed)
ufw enable
```

### Install Node.js (v20.x)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
```

Verify installation:

```bash
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x or higher
```

### Install PM2 (Process Manager)

```bash
npm install -g pm2
```

## 3. Database Setup

### Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### Configure PostgreSQL

```bash
# Start and enable PostgreSQL service
systemctl start postgresql
systemctl enable postgresql
```

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql
```

Inside PostgreSQL prompt, create database and user:

```sql
CREATE DATABASE gym_checkin;
CREATE USER gym_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE gym_checkin TO gym_user;
\c gym_checkin

-- Users table for admin access
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Check-ins table for member visits
CREATE TABLE check_ins (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255),
  phone_number VARCHAR(20),
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  membership_type VARCHAR(50),
  location_id VARCHAR(100),
  verified_by VARCHAR(50) REFERENCES users(username)
);

-- System logs for application events
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  severity VARCHAR(20) DEFAULT 'info'
);

-- Configuration table for system settings
CREATE TABLE configuration (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) REFERENCES users(username)
);

-- Create initial admin user (password: admin123)
INSERT INTO users (username, password_hash, email, role)
VALUES ('admin', '$2b$10$rBEPBvzUVE7GWKtZQxK5V.r6HV0YvpEX9Egi9wxQAjOYd0i9f0qVm', 'admin@example.com', 'admin');

\q
```

### Configure PostgreSQL for Remote Access (Optional)

If you need to access PostgreSQL remotely (not recommended for production):

```bash
# Edit PostgreSQL configuration
nano /etc/postgresql/14/main/postgresql.conf
```

Uncomment and modify:
```
listen_addresses = '*'
```

```bash
# Edit client authentication configuration
nano /etc/postgresql/14/main/pg_hba.conf
```

Add at the end:
```
host    all             all             0.0.0.0/0               md5
```

Restart PostgreSQL:
```bash
systemctl restart postgresql
```

## 4. Application Deployment

### Create Application Directory

```bash
mkdir -p /var/www/gym-checkin
chown gymadmin:gymadmin /var/www/gym-checkin
```

### Clone or Upload Application

If using Git:

```bash
cd /var/www/gym-checkin
git clone YOUR_REPOSITORY_URL .
```

Or upload your files using SCP:

```bash
# Run this from your local machine
scp -r /path/to/local/project/* gymadmin@YOUR_SERVER_IP:/var/www/gym-checkin/
```

### Install Dependencies

```bash
cd /var/www/gym-checkin
npm install --production
```

### Build the Application

```bash
cd /var/www/gym-checkin
```

If you encounter a "remix: not found" error when running `npm run build`, use one of these alternative build commands:

```bash
# Option 1: Use npx to run the locally installed remix CLI
npx remix vite:build

# Option 2: Use the direct path to the remix binary
./node_modules/.bin/remix vite:build

# Option 3: Install remix globally and then run the build
npm install -g @remix-run/dev
npm run build
```

Choose the option that works best for your environment. Option 1 or 2 is generally preferred as they use the locally installed version.

## 5. Environment Configuration

Create a `.env` file:

```bash
cd /var/www/gym-checkin
cp .env.example .env
nano .env
```

Add the following environment variables:

```
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key
SQUARE_LOCATION_ID=your_location_id
DATABASE_URL=postgresql://gym_user:your_secure_password@localhost:5432/gym_checkin
WEBHOOK_URL=https://your-webhook-endpoint.com/webhook
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter).

Set proper permissions:

```bash
chmod 640 /var/www/gym-checkin/.env
chown gymadmin:gymadmin /var/www/gym-checkin/.env
```

## 6. Running the Application

### Create PM2 Configuration

Create a file named `ecosystem.config.js`:

```bash
cd /var/www/gym-checkin
nano ecosystem.config.js
```

Add the following content:

```javascript
module.exports = {
  apps: [{
    name: "gym-checkin",
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "production",
    },
    max_memory_restart: "500M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/var/log/gym-checkin/error.log",
    out_file: "/var/log/gym-checkin/out.log"
  }]
};
```

Create log directory:

```bash
mkdir -p /var/log/gym-checkin
chown gymadmin:gymadmin /var/log/gym-checkin
```

### Start the Application

```bash
cd /var/www/gym-checkin
pm2 start ecosystem.config.js
```

#### Handling ES Module Compatibility Issues

If you encounter an error like `Error [ERR_REQUIRE_ESM]` when starting PM2, this is because your project is set up as an ES Module (with `"type": "module"` in package.json), but PM2 uses CommonJS to load configuration files.

You have three options to fix this:

1. **Rename your ecosystem config file to use the `.cjs` extension:**

```bash
mv ecosystem.config.js ecosystem.config.cjs
pm2 start ecosystem.config.cjs
```

2. **Create a new ecosystem config file with the `.cjs` extension:**

```bash
cat > ecosystem.config.cjs << 'EOL'
module.exports = {
  apps: [{
    name: "gym-checkin",
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "production",
    },
    max_memory_restart: "500M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/var/log/gym-checkin/error.log",
    out_file: "/var/log/gym-checkin/out.log"
  }]
};
EOL

pm2 start ecosystem.config.cjs
```

3. **Start your application directly with PM2:**

```bash
pm2 start npm --name "gym-checkin" -- start
```

The first option (renaming to .cjs) is the cleanest solution as it maintains your ES Module setup while making the PM2 config compatible with CommonJS.

### Configure PM2 to Start on Boot

```bash
pm2 startup
# Follow the instructions provided by the command
pm2 save
```

## 7. Setting Up Nginx as a Reverse Proxy

### Install Nginx

```bash
apt install -y nginx
```

### Configure Nginx

```bash
nano /etc/nginx/sites-available/gym-checkin
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase max body size for webhook payloads
    client_max_body_size 10M;
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/gym-checkin /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

## 8. SSL Configuration

### Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts to complete the SSL setup.

### Auto-renewal

Certbot sets up auto-renewal by default. Verify with:

```bash
systemctl status certbot.timer
```

## 9. Webhook Configuration

### Configure Square Webhooks

1. Log in to your Square Developer Dashboard
2. Navigate to your application
3. Go to the Webhooks section
4. Add a webhook endpoint: `https://your-domain.com/webhook`
5. Select the event types you want to subscribe to
6. Copy the Signature Key and update your `.env` file:

```bash
nano /var/www/gym-checkin/.env
# Update SQUARE_WEBHOOK_SIGNATURE_KEY
```

Restart the application:

```bash
pm2 restart gym-checkin
```

## 10. Post-Deployment Verification

### Verify Application Status

```bash
pm2 status
```

### Check Application Logs

```bash
pm2 logs gym-checkin
```

### Test Square API Connection

Visit `https://your-domain.com/admin` and check the System Status tab.

### Test Check-in Flow

1. Visit `https://your-domain.com/check-in`
2. Enter a valid phone number
3. Verify the check-in process works correctly

### Verify Webhook Reception

1. Perform a check-in
2. Check the application logs for webhook events:
   ```bash
   grep "webhook" /var/log/gym-checkin/out.log
   ```

### Verify Database Connection

Connect to the PostgreSQL database and check for new records:

```bash
sudo -u postgres psql -d gym_checkin -c "SELECT * FROM check_ins ORDER BY check_in_time DESC LIMIT 5;"
```

## 11. Maintenance and Monitoring

### Regular Backups

Set up a daily backup of your PostgreSQL database:

```bash
nano /etc/cron.daily/backup-gym-db
```

Add the following content:

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

Make it executable:

```bash
chmod +x /etc/cron.daily/backup-gym-db
```

### Monitoring with PM2

View real-time metrics:

```bash
pm2 monit
```

### Database Maintenance

Set up regular PostgreSQL maintenance:

```bash
nano /etc/cron.weekly/postgres-maintenance
```

Add the following content:

```bash
#!/bin/bash
# Run VACUUM ANALYZE to optimize database performance
sudo -u postgres psql -d gym_checkin -c "VACUUM ANALYZE;"
```

Make it executable:

```bash
chmod +x /etc/cron.weekly/postgres-maintenance
```

### Log Rotation

Configure log rotation:

```bash
nano /etc/logrotate.d/gym-checkin
```

Add the following:

```
/var/log/gym-checkin/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 gymadmin gymadmin
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Troubleshooting

### Application Won't Start

Check logs:
```bash
pm2 logs gym-checkin
```

Verify environment variables:
```bash
cat /var/www/gym-checkin/.env
```

### Database Issues

Check PostgreSQL service status:
```bash
systemctl status postgresql
```

Verify database connection:
```bash
sudo -u postgres psql -d gym_checkin -c "SELECT 1;"
```

Check database logs:
```bash
tail -f /var/log/postgresql/postgresql-14-main.log
```

### Nginx Issues

Check Nginx status:
```bash
systemctl status nginx
```

Check Nginx error logs:
```bash
tail -f /var/log/nginx/error.log
```

### SSL Issues

Verify certificate:
```bash
certbot certificates
```

Test SSL configuration:
```bash
curl -vI https://your-domain.com
```

## Conclusion

Your Gym Check-in System should now be successfully deployed on your Vultr server with PostgreSQL as the database. If you encounter any issues during deployment, refer to the troubleshooting section or check the application logs for more detailed error messages.

For ongoing maintenance, regularly:
- Monitor system performance
- Check application logs
- Update your server's security patches
- Backup your database
- Perform PostgreSQL maintenance tasks
- Renew your SSL certificate (automatic with Certbot)
