# Stugram Backend

## Production deployment checklist

Required Render/environment variables:

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `OTP_SECRET`
- `OTP_PROVIDER=sms` or `OTP_PROVIDER=email`
- SMS provider variables when `OTP_PROVIDER=sms`:
  - Twilio: `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`
  - Brevo: `SMS_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_SMS_SENDER`
- Email provider variables when `OTP_PROVIDER=email` or password reset email is enabled:
  - Resend: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - Brevo: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Firebase Admin credentials via `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, or service-account config

Production must not use:

- `OTP_PROVIDER=mock`
- `ALLOW_MEMORY_DB_FALLBACK=true`
- `ENABLE_BOOTSTRAP_USER=true`

Recommended rate-limit values:

- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=100`
- `AUTHENTICATED_RATE_LIMIT_MAX=1000`

Before deploying chat changes, verify MongoDB idempotency indexes:

```bash
npm run verify:chat-indexes
```

If the verifier reports missing indexes, apply the safe idempotent migration:

```bash
npm run migrate:chat-indexes
npm run verify:chat-indexes
```

After redeploy:

1. Confirm authenticated users can load profiles, search, and open chats without premature `429`.
2. Confirm unauthenticated request bursts still receive JSON `429` responses.
3. Confirm `/readyz` is healthy and no production mock providers are active.

## Scaling beyond a single instance

These knobs are off/conservative by default and only need to change once the
underlying infrastructure (bigger Render plan, dedicated Redis, larger MongoDB
Atlas tier) has been provisioned:

- `MONGO_MAX_POOL_SIZE` — overrides the Mongoose connection pool size (default
  20 in production, 10 elsewhere). Raise this in line with the MongoDB Atlas
  tier's connection limit when running more app instances.
- `SOCKET_IO_REDIS_ADAPTER_ENABLED=true` — attaches the
  `@socket.io/redis-adapter` so realtime chat/presence/typing events are
  broadcast across **all** backend instances via Redis pub/sub. Required as
  soon as more than one instance runs behind a load balancer, otherwise users
  connected to different instances won't see each other's realtime events.
  Requires `REDIS_URL`/`REDIS_REQUIRED=true` pointing at a Redis reachable from
  every instance. The adapter status is reported at `/health` and `/readyz`
  under `socketIoAdapter`.

When running multiple instances, the load balancer should also be configured
for sticky sessions (or Socket.IO falls back to HTTP long-polling, which still
works correctly with the Redis adapter but is less efficient than WebSockets).
