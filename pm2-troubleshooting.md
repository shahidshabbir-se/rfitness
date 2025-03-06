# PM2 Process Management Troubleshooting

## Error: "pm2 is not managing any process skipping save"

This error occurs because PM2 doesn't have any processes to save. You need to start your application with PM2 first.

## Solution Steps

### 1. Verify PM2 is installed correctly

```bash
pm2 --version
```

Should return a valid version number.

### 2. Check if any processes are running

```bash
pm2 list
```

This should show all processes managed by PM2. If empty, you need to start your application.

### 3. Start your application with PM2

Make sure you're in your application directory:

```bash
cd /var/www/gym-checkin
```

Then start your application:

```bash
pm2 start ecosystem.config.js
```

If you don't have an ecosystem.config.js file, you can create one or start directly:

```bash
pm2 start npm --name "gym-checkin" -- start
```

### 4. Verify the application is running

```bash
pm2 list
```

You should now see your application in the list.

### 5. Now save the process list

```bash
pm2 save
```

### 6. Set up PM2 to start on system boot

```bash
pm2 startup
```

This will give you a command to run. Copy and paste that command to set up PM2 to start on system boot.

## Troubleshooting

If your application fails to start:

1. Check the logs:
```bash
pm2 logs
```

2. Make sure your application can start normally:
```bash
cd /var/www/gym-checkin
npm start
```

3. Verify your ecosystem.config.js file (if using one):
```bash
cat ecosystem.config.js
```

Make sure the paths and commands are correct.
