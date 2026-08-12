# Security overview — ForOne Telegram bot

This document describes the security controls around the **payment
integrations** and the surrounding application. It is written to be read by a
payment provider's security reviewer.

- Integrations: **Click** Merchant API (Prepare / Complete callbacks) and
  **Payme (Paycom)** Merchant API (JSON-RPC)
- Runtime: Node.js, single service, TLS terminated by the host
- Storage: PostgreSQL (parameterised queries only)
- Code:
  - shared order ledger — [`src/orders.js`](src/orders.js)
  - Click protocol — [`src/click.js`](src/click.js)
  - Payme protocol — [`src/payme.js`](src/payme.js)
- Automated tests: [`test/clickSecurity.test.js`](test/clickSecurity.test.js)
  and [`test/paymeSecurity.test.js`](test/paymeSecurity.test.js) — every
  control is covered by a test, and each test has been verified to FAIL when
  the control it covers is deliberately removed.

**Design note.** What is being bought, by whom, and for how much lives in one
provider-neutral order ledger; each provider owns only its own protocol. That
is deliberate: the amount check, the paid/unpaid state and the delivery
guarantee are then literally the same code for every provider, so the two
cannot drift apart on the part that decides what gets granted. An order
settled by one provider is closed to the other — covered by a test.

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

- `CLICK_SECRET_KEY`, `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `PAYME_KEY`
  and `PAYME_MERCHANT_ID` are supplied as environment variables and are **not
  present in the repository**. The
  deployment blueprint (`render.yaml`) declares them with `sync: false`, so
  they are entered in the hosting UI and never enter version control.
- Each secret is used only inside its own verification step — the Click
  signature computation, the Payme Basic-auth comparison. Neither is ever
  logged, included in a response, or returned by any endpoint.
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

## 13. Payme (Paycom) specifics

Everything in §§3–5 applies unchanged — Payme settles the same orders through
the same ledger and the same delivery path. What differs is the protocol:

| Area | Click | Payme |
|---|---|---|
| Transport | two form-encoded endpoints | one JSON-RPC 2.0 endpoint (`/payme`) |
| Authentication | per-request MD5 signature | HTTP Basic, password = merchant key |
| Amount unit | so'm | **tiyin** (1 so'm = 100 tiyin) |
| Lifecycle | prepare → complete | created(1) → performed(2), or cancelled(−1/−2) |

**Authentication.** Every call must carry `Authorization: Basic` with the
merchant key. It is compared with `crypto.timingSafeEqual` behind a length
pre-check, and is checked **before the request is looked at at all** — an
unauthenticated caller cannot even learn whether a given order exists, which a
test asserts directly.

**Amount.** `params.amount` arrives in tiyin and is compared against the
server-side so'm price converted *up* (`price × 100`). The request value is
never divided down, because a fractional amount could then round into a match.
A test sends the so'm figure where tiyin is expected — the classic
factor-of-100 error — and asserts it is refused.

**Idempotency.** Payme retries every method, so every method is idempotent:
`CreateTransaction` returns the original transaction and its original
`create_time`; `PerformTransaction` repeats the first `perform_time` without
delivering again; `CancelTransaction` repeats the first `cancel_time`. Only
one live transaction may exist per order, so two checkouts cannot both be
performed against a single purchase. All four are covered by tests.

**Reversals.** A `CancelTransaction` after a successful perform is recorded as
state −2 and the order is returned to unpaid, but access already granted is
**not** silently clawed back — withdrawing something a person is using is a
business decision, not something a callback should do unattended. The reversal
is logged loudly and is visible in the admin panel.

**Errors.** An unexpected internal failure returns a well-formed JSON-RPC
error rather than an HTTP 500 or a stack trace: a malformed reply would make
Payme retry indefinitely, and internal details must never reach a provider.

---

## Verifying these claims

```bash
npm test                           # full suite (148 tests)
node test/clickSecurity.test.js    # Click payment controls only
node test/paymeSecurity.test.js    # Payme payment controls only
```

Each control in §§1–7 and §13 has a corresponding test that has been confirmed
to fail when that control is removed — the tests demonstrate the protections,
rather than merely accompanying them.
