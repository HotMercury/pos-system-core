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

## Run the MVP on a Mac mini

The Mac mini is the runtime host. The development computer only pushes code to
GitHub; it does not need to host the live database or API.

1. Install Docker Desktop on the Mac mini and clone this repository.
2. Create a root `.env` file with a database password:
   ```
   POSTGRES_PASSWORD=change-this-password
   ```
3. Start PostgreSQL and the API:
   ```
   docker compose up -d --build
   ```
4. Seed the initial tables and products once:
   ```
   docker compose exec api npm run db:seed -w @pos/database
   ```
5. Open the customer page on the local network:
   ```
   http://<mac-mini-ip>:3000/customer/?table=A1
   ```
6. Open the kitchen display:
   ```
   http://<mac-mini-ip>:3000/kds/
   ```

Do not expose PostgreSQL to the internet. Only the API port should be exposed
through the local network or a later Cloudflare Tunnel.
