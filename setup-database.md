# Database Setup Guide

## Current Status
The AutoForwardX system is currently running with **in-memory storage** which works perfectly for development and testing. Data is stored in memory and will reset when the server restarts.

## PostgreSQL Database Integration

### Option 1: Neon Database (Recommended for Production)
1. Sign up for a free account at [Neon.tech](https://neon.tech)
2. Create a new database project
3. Copy the connection string
4. Add it to your `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@ep-example.us-east-2.aws.neon.tech/database?sslmode=require
   ```
5. Run the migration: `npm run db:push`
6. Restart the server: The system will automatically detect and use the database

### Option 2: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database: `createdb autoforwardx`
3. Set DATABASE_URL in `.env`:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/autoforwardx
   ```
4. Run `npm run db:push`
5. Restart the server

### Option 3: Continue with In-Memory Storage
The current setup works great for development and testing:
- ✅ All features work identically
- ✅ No database setup required
- ✅ Fast performance
- ⚠️ Data resets on server restart

## Schema Information
The database schema is defined in `shared/schema.ts` and includes:
- **Users**: Authentication and user management
- **Pairs**: Message forwarding route configurations
- **Sessions**: Telegram userbot session data
- **Blocklists**: Content filtering rules
- **Activities**: System activity logging
- **Message Mappings**: Cross-platform message relationships
- **System Stats**: Performance metrics

## Data Migration
When switching from in-memory to database storage:
1. Current data will be lost (expected behavior)
2. Users will need to be recreated (use existing PINs: 1234, 0000, 5599)
3. Sessions will need to be re-created through the UI
4. Pairs and blocklists will need to be reconfigured

The hybrid storage system automatically handles the transition seamlessly.