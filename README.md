# Open Helpdesk — Backend

The REST API behind [Open Helpdesk](https://github.com/Hyzokaaa/open-helpdesk), the open-source helpdesk for modern teams. Built with NestJS, TypeORM and PostgreSQL.

> Looking to **install** Open Helpdesk? Start at the [main repository](https://github.com/Hyzokaaa/open-helpdesk): it covers Docker Compose, the native install script and manual deployment. This repository is for working on the API itself.

[Website](https://openhelpdesk.dev) · [API docs](https://openhelpdesk.dev/docs) · [Frontend](https://github.com/Hyzokaaa/open-helpdesk-client) · [Releases](https://github.com/Hyzokaaa/open-helpdesk-backend/releases)

## Requirements

- Node.js 22+
- PostgreSQL 15+
- File storage: a local folder, or any S3-compatible service (AWS S3, MinIO…)

Docker is optional. It is only a convenient way to get PostgreSQL and MinIO running for development.

## Run it locally

```bash
npm install
cp .env.example .env
```

**With Docker** for the database and storage:

```bash
docker compose up -d        # PostgreSQL on :5432, MinIO on :9000 (console :9001)
```

**Without Docker**: point `DB_*` in `.env` at your own PostgreSQL and set `STORAGE_PROVIDER=filesystem` so attachments go to local disk instead of S3.

Then:

```bash
npm run start:dev           # API on http://localhost:3000
```

On startup the API runs pending migrations and creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`admin@example.com` / `admin1234` in `.env.example`). Start the [frontend](https://github.com/Hyzokaaa/open-helpdesk-client) and sign in.

Every setting is documented in [`.env.example`](.env.example). Email (SMTP/Postmark), Google sign-in and AI features are optional.

## Deploying

- **Docker**: a production image is published to `ghcr.io/hyzokaaa/open-helpdesk-backend` and used by the main repository's Docker Compose setup.
- **Native**: [`install.sh`](install.sh) installs the API on a Linux server as a systemd service (Node.js 22+ and PostgreSQL 15+ required). It is interactive, so download it first and then run `bash install.sh`. [`update.sh`](update.sh) upgrades an existing install.

The [main repository](https://github.com/Hyzokaaa/open-helpdesk#option-3-manual-deployment-without-docker) has the full guide, including Nginx and HTTPS.

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | API in watch mode |
| `npm test` | Unit tests (Jest) |
| `npm run test:cov` | Unit tests with coverage |
| `npm run lint` | ESLint with autofix |
| `npm run build` / `npm run start:prod` | Production build and run |
| `npm run migration:generate:clean <Name>` | Recreates the database and generates a migration from the schema diff |
| `npm run migration:run` / `migration:revert` | Apply or undo migrations by hand |

## Architecture

Each feature is a module with three layers:

```
src/<module>/
  application/      commands and queries — use cases, no business logic
  domain/           entities, enums, repository interfaces, domain services
  infrastructure/   NestJS controllers and TypeORM models/repositories
```

Business rules live in domain services and depend only on repository interfaces, so they are tested against in-memory mocks (`test/mocks`) without a database.

## Contributing

1. Fork the repository and branch from `dev`.
2. Follow the layering above and add tests for domain services you touch.
3. Make sure `npm test` and `npm run lint` pass.
4. Open a pull request against `dev`.

Bugs and feature requests are welcome as [issues](https://github.com/Hyzokaaa/open-helpdesk-backend/issues).

## License

[AGPL-3.0](LICENSE)
