# Security Setup

The protected admin mode is served by `server/secure-server.mjs`.

## Local

```bash
cp .env.example .env
npm run security:hash -- "your-long-admin-password"
# Paste the printed hash into FP_ADMIN_PASSWORD_HASH in .env
# Replace FP_SESSION_SECRET with a long random string
npm run build
npm run secure:server
```

Open `http://localhost:8787`.

## Production

Set real secrets before deployment:

```bash
npm run security:hash -- "a long unique admin password"
```

Use the printed value as `FP_ADMIN_PASSWORD_HASH`, then set:

```bash
FP_ADMIN_LOGIN=FRONTE
FP_ADMIN_PASSWORD_HASH=...
FP_SESSION_SECRET=at-least-32-random-characters
FP_ALLOWED_ORIGINS=https://your-domain.example
NODE_ENV=production
```

Do not deploy production with the development fallback password.
