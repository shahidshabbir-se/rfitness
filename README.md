# R-Fitness Gym Check-in System

A web application for managing gym member check-ins, built with Remix, Prisma, and Square API.

## Features

- Member check-in via phone number
- Square API integration for membership verification
- Admin dashboard with real-time check-in notifications
- Check-in history and analytics
- PostgreSQL database for data persistence
- Docker support for development and production

## Tech Stack

- **Frontend**: React, Remix, TailwindCSS
- **Backend**: Node.js, Remix
- **Database**: PostgreSQL with Prisma ORM
- **API Integration**: Square API for membership verification
- **Deployment**: Docker, Docker Swarm

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for development with database)
- Square Developer Account (for API access)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rfitness.git
   cd rfitness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your Square API credentials and database connection string.

4. Start the development database:
   ```bash
   docker-compose -f compose.dev.yaml up -d
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Database Implementation

The application uses PostgreSQL with Prisma ORM for data persistence. The database schema includes:

- **User**: Staff and admin users
- **Customer**: Gym members with membership information
- **CheckIn**: Records of member check-ins
- **Configuration**: System configuration settings
- **SystemLog**: System activity and error logs

For detailed information about the database implementation, see the [Database Implementation Guide](./database-implementation-guide.md).

## Production Deployment

For production deployment instructions, see the [Deployment Guide](./deployment-guide.md).

## Environment-Specific Behavior

The application behaves differently based on the environment:

### Development Environment
- Uses mock data when Square API is not configured
- Still stores check-ins and customer data in the database for testing
- Logs system events to both memory and database

### Production Environment
- Uses real data from Square API
- Stores all check-ins and customer data in the database
- Logs all system events to the database for monitoring

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
