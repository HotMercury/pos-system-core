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
   ADMIN_PIN=change-this-admin-pin
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

7. Open the staff admin page:
   ```
   http://<mac-mini-ip>:3000/admin/
   ```

The admin page uses `ADMIN_PIN` from the root `.env` to manage product and
variant availability and prices. Changes are stored in PostgreSQL and do not
require rebuilding or restarting the application.

The customer logo is served from
`apps/customer-web/public/images/logo.png`. Customer app background images can be placed at
`apps/customer-web/public/images/app-background.webp`. The customer page loads
that file as its global background and keeps a light overlay for readability.

Do not expose PostgreSQL to the internet. Only the API port should be exposed
through the local network or a later Cloudflare Tunnel.
