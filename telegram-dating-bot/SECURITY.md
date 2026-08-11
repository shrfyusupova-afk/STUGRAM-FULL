# Security overview — ForOne Telegram bot

This document describes the security controls around the **Click Merchant API
integration** and the surrounding application. It is written to be read by a
payment provider's security reviewer.

- Integration type: Click Merchant API (Prepare / Complete callbacks)
- Runtime: Node.js, single service, TLS terminated by the host
- Storage: PostgreSQL (parameterised queries only)
- Payment code: [`src/click.js`](src/click.js)
- Automated tests for the controls below:
  [`test/clickSecurity.test.js`](test/clickSecurity.test.js) — every control
  is covered by a test, and each test has been verified to FAIL when the
  control it covers is deliberately removed.

---

## 1. Callback authentication

Both `/click/prepare` and `/click/complete` verify the Click signature
**before any other processing**, and reject the request outright if it does
not match.

| Property | Implementation |
|---|---|
| Prepare signature | `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)` |
| Complete signature | as above, with `merchant_prepare_id` inserted before `amount` |
| Comparison | `crypto.timingSafeEqual`, with a length pre-check — never `===` |
| On failure | `error: -1` (`SIGN CHECK FAILED`); nothing is read or written |

Constant-time comparison is used so that response timing cannot reveal how
many leading characters of a guessed signature were correct.

**The two endpoints sign different strings**, so a captured Prepare callback
cannot be replayed against Complete. This is covered by a test.

## 2. Envelope validation

After the signature passes, the callback must also be for this merchant and
for the endpoint it arrived at:

- `service_id` must equal `CLICK_SERVICE_ID`
- `action` must be `0` on `/click/prepare` and `1` on `/click/complete`

Both fields are inside the signed string, so these checks are defence in
depth rather than the primary control — they make the protocol contract
explicit and reject correctly-signed traffic intended for a different
service.

## 3. Amount integrity

**The amount is never taken from the client.** When a checkout is opened, the
order is created server-side with a price read from a constant in
`src/click.js` (`priceForType`). The user's request carries only *which
product* they want, never *what it costs*.

The amount Click reports is then compared against that stored value on
**both** callbacks:

- mismatch → `error: -2` (`Incorrect amount`), and nothing is granted
- checked on Complete as well as Prepare, so a mismatch is caught before the
  order is ever marked paid

A test confirms that an attempt to settle a 79 900 UZS order for 9 900 UZS is
refused and grants nothing.

## 4. Idempotency / replay protection

Delivery is gated on an **atomic status transition**, not on a read-then-write:

```
markTransaction(id, fromStatus, "paid")  -- returns the row ONLY if it
                                             was still in fromStatus
```

Only the caller that actually moves the row off its previous status receives
a row back, and only that caller triggers delivery. Concurrent or repeated
Completes therefore cannot pay out twice; the duplicate is answered
`error: -4` (`Already paid`).

A test replays a byte-identical, correctly-signed Complete and asserts that
the subscription end date does not move.

## 5. Delivery guarantees

"Paid" and "the customer received what they paid for" are recorded as
separate facts.

- Click is always answered `error: 0` once the money is confirmed — answering
  otherwise would cause Click to reverse a payment that genuinely succeeded.
- If granting the feature fails afterwards (e.g. Telegram is unreachable),
  the order stays flagged undelivered, the attempt counter is incremented,
  and a background sweep retries it.
- This means a downstream outage can delay delivery but cannot silently lose
  a paid order.

## 6. Abuse control on the public endpoints

The callback URLs must be reachable from the internet. Requests that fail
signature verification are counted per source IP; a sustained flood is
answered `429` and stops consuming the rest of the handler.

**Signature verification always runs first, and a request that passes it is
never throttled**, regardless of other traffic from the same IP. This
ordering is deliberate: the failure mode of a rate limiter on a payment path
is a refused payment, so legitimate traffic is structurally incapable of
tripping it. A test asserts that a valid callback is still processed from an
IP that is actively being throttled.

The counter is swept periodically so it cannot grow without bound.

## 7. Order identifiers

Order references (`merchant_trans_id`) are generated as
`{type}_{96 bits of crypto.randomBytes}`. They are unguessable and contain no
user data.

Knowing an order id confers nothing on its own — every state-changing
operation still requires a valid signature, which requires the shared secret.
A test asserts this directly.

## 8. Request parsing

The Click endpoints use `express.urlencoded({ extended: false, limit: "16kb" })`:

- `extended: false` — Click's callbacks are flat form fields; the nested
  object/array syntax is not enabled, reducing what an attacker can shape the
  request body into before application code inspects it.
- `limit: "16kb"` — far above a real callback (a few hundred bytes), far below
  anything worth buffering.

The JSON fallback ledger uses null-prototype objects so that a key such as
`__proto__` in an echoed `merchant_trans_id` behaves as an ordinary unknown
key.

## 9. Secret management

- `CLICK_SECRET_KEY`, `CLICK_MERCHANT_ID` and `CLICK_SERVICE_ID` are supplied
  as environment variables and are **not present in the repository**. The
  deployment blueprint (`render.yaml`) declares them with `sync: false`, so
  they are entered in the hosting UI and never enter version control.
- The secret is used only inside the signature computation. It is never
  logged, never included in a response, and never returned by any endpoint.
- The health endpoint reports only *whether* payment credentials are
  configured, never their values.

## 10. Data storage

- PostgreSQL with **parameterised queries throughout** — no string-built SQL
  anywhere in the payment path or elsewhere.
- Ledger writes use atomic status transitions (see §4).
- The JSON fallback (used only without a database) writes via temp-file +
  rename, so a torn write cannot corrupt the ledger, and a ledger that fails
  to parse is preserved rather than overwritten.

## 11. Application-level controls

Outside the payment path, relevant to overall exposure:

- **Telegram webhooks** are verified with `secret_token`, so forged updates
  are rejected. The value is auto-generated if not supplied, so the endpoint
  is never left unauthenticated.
- **Per-user flood guard** on both bots, ahead of all other middleware.
- **Admin panel** is not discoverable: `/start` shows an ordinary public FAQ
  screen, and the PIN entry is behind an unadvertised command. The PIN itself
  is compared in constant time and protected by per-user exponential backoff
  plus a global attempt ceiling. Sessions expire after 12 hours.
- **Mini App** requests are authenticated by verifying Telegram's `initData`
  HMAC (constant-time, with a freshness window). Prices shown there are read
  from the server, never from the request.
- **Uncaught exceptions terminate the process** so the platform restarts a
  known-good one, rather than continuing in an undefined state.
- Admin-granted ("gifted") entitlements are deliberately **not** written to
  the sales ledger, so revenue figures reflect real payments only.

## 12. Known operational risks

Stated plainly rather than omitted:

- The service currently runs on a single instance. Availability depends on the
  host; there is no multi-region failover.
- Delivery retries are bounded by the sweep interval, so a prolonged Telegram
  outage delays (but does not lose) feature delivery.
- Signature `sign_time` freshness is **not** enforced as a hard window. Replay
  is already fully prevented by the atomic status transition in §4, and a
  strict time window risks rejecting Click's own legitimate retries. This is a
  deliberate trade-off, not an oversight.

---

## Verifying these claims

```bash
npm test                      # full suite, includes the payment security tests
node test/clickSecurity.test.js   # payment controls only
```

Each control in §§1–7 has a corresponding test that has been confirmed to
fail when that control is removed — the tests demonstrate the protections,
rather than merely accompanying them.
