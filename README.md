# POS System Core

## Database (packages/database)

This project uses PostgreSQL (via Docker) and Prisma as the ORM.

### Setup

1. Start the database:
   ```
   docker compose up -d
   ```

2. Configure environment variables:
   Copy `packages/database/.env.example` to `packages/database/.env`
   and set `DATABASE_URL`, e.g.:
   ```
   postgresql://postgres:<password>@localhost:5432/pos_db?schema=public
   ```

3. Apply migrations:
   ```
   cd packages/database
   npx prisma migrate dev
   ```

4. Seed development data:
   ```
   npx prisma db seed
   ```
