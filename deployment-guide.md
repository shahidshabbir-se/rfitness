# Deployment Guide for R-Fitness Gym Check-in System

This guide provides step-by-step instructions for deploying the R-Fitness Gym Check-in System to a production environment.

## Prerequisites

Before deploying, ensure you have:

1. A server or cloud instance running Linux (Ubuntu 20.04 LTS or newer recommended)
2. Docker and Docker Compose installed
3. Domain name configured with DNS pointing to your server
4. Square Developer account with API credentials
5. Basic knowledge of Docker, Nginx, and Linux server administration

## Deployment Steps

### 1. Prepare Your Environment

Clone the repository to your local machine:

```bash
git clone https://github.com/your-username/rfitness.git
cd rfitness
```

### 2. Configure Environment Variables

Create a `.env.production` file in the root directory with the following variables:

```
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret
SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_LOCATION_ID=your-square-location-id
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_SIGNATURE_KEY=your-webhook-signature-key
SQUARE_WEBHOOK_URL=https://checkin.rfitnessbelfast.com/api/webhook
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/rfitness
```

### 3. Set Up Docker Secrets

Create a secure password for the PostgreSQL database:

```bash
echo "your-secure-db-password" | docker secret create postgres_password -
```

### 4. Initialize Docker Swarm

If not already initialized, set up Docker Swarm:

```bash
docker swarm init --advertise-addr <YOUR-SERVER-IP>
```

### 5. Build and Deploy the Application

Deploy the application stack:

```bash
docker stack deploy -c docker-stack.yaml rfitness
```

### 6. Verify Deployment

Check that all services are running:

```bash
docker service ls
```

You should see three services running:
- `rfitness_traefik`: The reverse proxy
- `rfitness_app`: The application
- `rfitness_db`: The PostgreSQL database

### 7. Run Database Migrations

Execute Prisma migrations to set up the database schema:

```bash
docker exec $(docker ps -q -f name=rfitness_app) npx prisma migrate deploy
```

### 8. Set Up SSL with Let's Encrypt

The Traefik service is configured to automatically obtain and renew SSL certificates from Let's Encrypt. Ensure your domain is correctly pointed to your server's IP address.

### 9. Configure Square Webhooks

1. Log in to your [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to the Webhooks section
4. Add a webhook subscription with the URL: `https://checkin.rfitnessbelfast.com/api/webhook`
5. Subscribe to the following event types:
   - `customer.created`
   - `customer.updated`
   - `customer.deleted`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
6. Copy the Webhook Signature Key provided by Square
7. Update your `.env.production` file with the `SQUARE_WEBHOOK_SIGNATURE_KEY` value

### 10. Verify the Application

Open your browser and navigate to `https://checkin.rfitnessbelfast.com`. You should see the R-Fitness Gym Check-in System login page.

## Database Management

### Accessing the Database

To connect to the PostgreSQL database:

```bash
docker exec -it $(docker ps -q -f name=rfitness_db) psql -U postgres -d rfitness
```

### Backup and Restore

To backup the database:

```bash
docker exec -t $(docker ps -q -f name=rfitness_db) pg_dump -U postgres rfitness > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore from a backup:

```bash
cat backup_file.sql | docker exec -i $(docker ps -q -f name=rfitness_db) psql -U postgres -d rfitness
```

## Monitoring and Logging

### Viewing Application Logs

```bash
docker service logs rfitness_app
```

### Viewing Database Logs

```bash
docker service logs rfitness_db
```

### Viewing Traefik Logs

```bash
docker service logs rfitness_traefik
```

### Monitoring System Status

The application includes a built-in monitoring dashboard accessible at `https://checkin.rfitnessbelfast.com/admin`. This dashboard provides:

1. Recent check-ins
2. System logs
3. Webhook status
4. Database connection status
5. Analytics data

## Updating the Application

To update the application to a new version:

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Rebuild and redeploy:
   ```bash
   docker build -t rfitness:latest .
   docker stack deploy -c docker-stack.yaml rfitness
   ```

3. Run any new migrations:
   ```bash
   docker exec $(docker ps -q -f name=rfitness_app) npx prisma migrate deploy
   ```

## Troubleshooting

### Database Connection Issues

If the application cannot connect to the database:

1. Check that the database service is running:
   ```bash
   docker service ps rfitness_db
   ```

2. Verify the database URL in the environment variables:
   ```bash
   docker exec $(docker ps -q -f name=rfitness_app) printenv | grep DATABASE_URL
   ```

3. Check database logs for errors:
   ```bash
   docker service logs rfitness_db
   ```

### Square API Connection Issues

If the application cannot connect to Square API:

1. Verify your Square API credentials in the environment variables:
   ```bash
   docker exec $(docker ps -q -f name=rfitness_app) printenv | grep SQUARE
   ```

2. Check application logs for Square API errors:
   ```bash
   docker service logs rfitness_app | grep "Square API"
   ```

3. Verify webhook configuration in the Square Developer Dashboard

### Webhook Issues

If webhooks are not being received or processed:

1. Check that the webhook URL is correctly configured in Square Developer Dashboard
2. Verify the webhook signature key is correctly set in your environment variables
3. Check application logs for webhook-related errors:
   ```bash
   docker service logs rfitness_app | grep "webhook"
   ```
4. Ensure your domain is correctly pointed to your server and SSL is properly configured

### SSL Certificate Issues

If Traefik fails to obtain SSL certificates:

1. Ensure your domain is correctly pointed to your server's IP address
2. Check Traefik logs for Let's Encrypt errors:
   ```bash
   docker service logs rfitness_traefik | grep "Let's Encrypt"
   ```

3. Verify that ports 80 and 443 are open on your server's firewall

## Scaling the Application

To scale the application horizontally:

```bash
docker service scale rfitness_app=3
```

This will run three instances of the application container, with Traefik automatically load balancing between them.

## Security Considerations

1. Keep your server and Docker up to date with security patches
2. Regularly rotate your Square API credentials and database passwords
3. Enable firewall rules to restrict access to only necessary ports
4. Set up regular database backups
5. Monitor system logs for suspicious activity
6. Use strong, unique passwords for all services

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Square API Documentation](https://developer.squareup.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
