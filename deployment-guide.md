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

The application uses SQLite for simplicity, which doesn't require a separate database server.

### Install SQLite

```bash
apt install -y sqlite3
```

### Create Database Directory

```bash
mkdir -p /var/lib/gym-checkin
chown gymadmin:gymadmin /var/lib/gym-checkin
```

### Initialize Database

```bash
cd /var/lib/gym-checkin
sqlite3 gym.db
```

Inside SQLite prompt, create necessary tables:

```sql
CREATE TABLE check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  phone_number TEXT,
  check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  membership_type TEXT
);

CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT,
  message TEXT,
  details TEXT
);

.exit
```

Set proper permissions:

```bash
chown gymadmin:gymadmin /var/lib/gym-checkin/gym.db
chmod 640 /var/lib/gym-checkin/gym.db
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
npm run build
```

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
DATABASE_URL=file:/var/lib/gym-checkin/gym.db
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

## 11. Maintenance and Monitoring

### Regular Backups

Set up a daily backup of your SQLite database:

```bash
nano /etc/cron.daily/backup-gym-db
```

Add the following content:

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d")
BACKUP_DIR="/var/backups/gym-checkin"
mkdir -p $BACKUP_DIR
sqlite3 /var/lib/gym-checkin/gym.db ".backup '$BACKUP_DIR/gym-$TIMESTAMP.db'"
find $BACKUP_DIR -name "gym-*.db" -mtime +30 -delete
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

Check database permissions:
```bash
ls -la /var/lib/gym-checkin/gym.db
```

Verify database connection:
```bash
sqlite3 /var/lib/gym-checkin/gym.db "SELECT count(*) FROM sqlite_master;"
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

Your Gym Check-in System should now be successfully deployed on your Vultr server. If you encounter any issues during deployment, refer to the troubleshooting section or check the application logs for more detailed error messages.

For ongoing maintenance, regularly:
- Monitor system performance
- Check application logs
- Update your server's security patches
- Backup your database
- Renew your SSL certificate (automatic with Certbot)
