# MAGUMEDS

Medical Aid Management System.

## Quick start (Backend)

- Copy `.env.example` to `.env` and adjust values. If you already have PostgreSQL running locally, just set `DATABASE_URL` to your full connection URL, e.g.:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/magumeds
```

- Install dependencies and run migrations.

## API Docs

Swagger UI at `/api/docs/`, OpenAPI schema at `/api/schema/`.

## Auth

- `POST /api/auth/login/` returns access/refresh tokens and user info.
- `POST /api/auth/refresh/` to refresh access token.

