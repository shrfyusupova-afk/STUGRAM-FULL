// Click Merchant API: signature verification and the Prepare/Complete
// callbacks. Nothing about WHAT is being bought lives here -- that is the
// shared order ledger in orders.js, which every provider settles against.
//
// See SECURITY.md for the full control set and what each one does and does
// not protect against.
const crypto = require("crypto");
const {
  createOrder,
  getOrder,
  markOrder,
  deliverOrder,
  getSalesSummary,
  getSalesRows,
  retryUndeliveredOrders,
  extendFrom,
  priceForType,
  PREMIUM_PRICE_SOM,
  PREMIUM_DAYS,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  ANON_GENDER_DAYS,
} = require("./orders");

// https://docs.click.uz/en/click-api-request/ -- Merchant API error codes.
const ERROR = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  AMOUNT_MISMATCH: -2,
  TRANSACTION_CANCELLED: -9,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
};

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

// Plain === leaks how many leading characters matched via response-time
// differences -- crypto.timingSafeEqual instead, so guessing the signature
// can't be sped up by timing the comparison itself. Length is checked first
// since timingSafeEqual throws (rather than returning false) on a mismatch,
// and the length check itself leaks nothing secret (signatures are always
// fixed-length hex, so length alone tells an attacker nothing).
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Prepare (action=0): md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
function verifyPrepareSign(body, secretKey) {
  const expected = md5(
    `${body.click_trans_id}${body.service_id}${secretKey}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`
  );
  return timingSafeEqualStr(expected, body.sign_string);
}

// Complete (action=1): same as Prepare but with merchant_prepare_id inserted before amount.
function verifyCompleteSign(body, secretKey) {
  const expected = md5(
    `${body.click_trans_id}${body.service_id}${secretKey}${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`
  );
  return timingSafeEqualStr(expected, body.sign_string);
}

// Click's merchant_id and service_id are numeric identifiers. A value that
// is not is always a copy-paste mistake -- the cabinet shows the id next to
// the merchant's phone number, and pasting "63267_998909453305" instead of
// "63267" produces a checkout page that loads, then says "Поставщик не
// найден" and closes. That failure is invisible from here: the URL builds
// fine, the bot looks healthy, and only the first person who actually tries
// to pay finds out. So it is checked at startup and surfaced on /health.
function clickConfigProblem() {
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const serviceId = process.env.CLICK_SERVICE_ID;
  if (merchantId && !/^\d+$/.test(merchantId.trim())) {
    return `CLICK_MERCHANT_ID must be digits only, got "${merchantId}"`;
  }
  if (serviceId && !/^\d+$/.test(serviceId.trim())) {
    return `CLICK_SERVICE_ID must be digits only, got "${serviceId}"`;
  }
  return null;
}

function buildCheckoutUrl(merchantTransId, amountSom) {
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const serviceId = process.env.CLICK_SERVICE_ID;
  if (!merchantId || !serviceId) return null;

  const params = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(amountSom),
    transaction_param: merchantTransId,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

// --- abuse control on the public payment endpoints -------------------------
//
// /click/prepare and /click/complete are open to the internet by necessity --
// Click's servers have to reach them. Everything below the signature check is
// already unreachable without CLICK_SECRET_KEY, so the exposure is not
// forgery; it is that an unauthenticated flood still costs an MD5 and a
// request slot each, against one small instance.
//
// The signature is therefore ALWAYS checked first, and a request that passes
// it is never throttled -- no matter how much noise shares its IP. That
// ordering is deliberate and is what makes this safe to run on a money path
// at all: the failure mode of a rate limiter here is a refused payment, so
// legitimate traffic must be structurally incapable of tripping it. (An
// earlier version checked the counter first, to skip the hash on flooded
// requests; a test showed that this also refused a valid callback arriving
// from a flooded IP. The hash is microseconds -- not worth that risk.)
//
// What this does buy: a persistent unauthenticated flood gets a 429 and stops
// consuming the rest of the handler, and the logs stay readable.
const CLICK_ABUSE_WINDOW_MS = 60 * 1000;
const CLICK_MAX_BAD_SIGNS = 20;
const badSigns = new Map(); // ip -> { count, windowStart }

function tooManyBadSigns(ip) {
  const entry = badSigns.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > CLICK_ABUSE_WINDOW_MS) {
    badSigns.delete(ip);
    return false;
  }
  return entry.count >= CLICK_MAX_BAD_SIGNS;
}

function recordBadSign(ip) {
  const now = Date.now();
  const entry = badSigns.get(ip);
  if (!entry || now - entry.windowStart > CLICK_ABUSE_WINDOW_MS) {
    badSigns.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count++;
}

// One entry per attacking IP, and nothing removes them on its own -- the same
// unbounded-growth shape already fixed in floodGuard.js and adminBot.js.
const BAD_SIGN_SWEEP_MS = 10 * 60 * 1000;
function sweepBadSigns(now = Date.now()) {
  let removed = 0;
  for (const [ip, entry] of badSigns) {
    if (now - entry.windowStart > CLICK_ABUSE_WINDOW_MS) {
      badSigns.delete(ip);
      removed++;
    }
  }
  return removed;
}
setInterval(sweepBadSigns, BAD_SIGN_SWEEP_MS).unref();

// Click sends action=0 for Prepare and action=1 for Complete.
const ACTION_PREPARE = 0;
const ACTION_COMPLETE = 1;

// Rejects a callback that is correctly signed but is not for THIS merchant's
// service, or carries the wrong action for the endpoint it arrived at.
//
// Both fields are inside the signed string, so neither check is what stops
// forgery -- an outsider cannot alter either without invalidating the
// signature. They are defence in depth, and they make the protocol contract
// explicit instead of implied. Both are required fields in Click's Merchant
// API on both callbacks, so a legitimate request always carries them.
function wrongEnvelope(body, expectedAction) {
  const serviceId = process.env.CLICK_SERVICE_ID;
  if (serviceId && String(body.service_id) !== String(serviceId)) return "service_id mismatch";
  if (Number(body.action) !== expectedAction) return "unexpected action";
  return null;
}

// Every callback, logged the moment it lands and before anything can reject
// it.
//
// The question this exists to answer is "did Click ever reach us?", and it
// was previously unanswerable: a callback with a bad signature was rejected
// in silence, so a wrong CLICK_SECRET_KEY looked EXACTLY like Click never
// calling at all. Those two have completely different fixes -- one is a key
// in this app's environment, the other is a URL in Click's cabinet -- and
// picking between them by guesswork is how a stuck payment stays stuck.
function logCallback(kind, body) {
  console.log(
    `Click ${kind} received: order=${body.merchant_trans_id} ` +
      `click_trans=${body.click_trans_id} amount=${body.amount} service=${body.service_id}`
  );
}

// Loud, and specific about the two ways it happens. "No secret key
// configured" and "the key does not match Click's" produce the same refusal
// on the wire but are different mistakes.
function logSignFailure(kind, body, secretKey) {
  if (!secretKey) {
    console.error(
      `Click ${kind} REFUSED for order=${body.merchant_trans_id}: CLICK_SECRET_KEY is not set, ` +
        `so no callback can ever be accepted and every payment will hang.`
    );
    return;
  }
  console.error(
    `Click ${kind} REFUSED for order=${body.merchant_trans_id}: signature did not match. ` +
      `Almost always CLICK_SECRET_KEY here differing from the key in the Click cabinet ` +
      `(service_id=${body.service_id}).`
  );
}

function registerClickRoutes(app, { onPaid, bodyParser } = {}) {
  const secretKey = process.env.CLICK_SECRET_KEY;
  const middleware = bodyParser ? [bodyParser] : [];

  app.post("/click/prepare", ...middleware, async (req, res) => {
    const body = req.body || {};
    logCallback("prepare", body);
    const signFailed = {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      error: ERROR.SIGN_FAILED,
      error_note: "SIGN CHECK FAILED",
    };

    // Signature first, always -- a valid callback is processed even from an
    // IP that is mid-flood. Only a request that fails it can be throttled.
    if (!secretKey || !verifyPrepareSign(body, secretKey)) {
      logSignFailure("prepare", body, secretKey);
      const overLimit = tooManyBadSigns(req.ip);
      recordBadSign(req.ip);
      return res.status(overLimit ? 429 : 200).json(signFailed);
    }

    const envelopeProblem = wrongEnvelope(body, ACTION_PREPARE);
    if (envelopeProblem) {
      console.warn(`Click prepare rejected (${envelopeProblem}) for ${body.merchant_trans_id}`);
      return res.json(signFailed);
    }

    const order = await getOrder(body.merchant_trans_id);
    if (!order) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.ORDER_NOT_FOUND,
        error_note: "Order not found",
      });
    }
    if (Number(body.amount) !== order.amount) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.AMOUNT_MISMATCH,
        error_note: "Incorrect amount",
      });
    }
    if (order.status === "paid") {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.ALREADY_PAID,
        error_note: "Already paid",
      });
    }

    // 'prepared' can be re-sent by Click; only the pending -> prepared move
    // needs to actually happen, and a repeat is still a success for Click.
    await markOrder(body.merchant_trans_id, "pending", "prepared", {
      clickTransId: body.click_trans_id,
    });

    return res.json({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_prepare_id: body.merchant_trans_id,
      error: ERROR.SUCCESS,
      error_note: "Success",
    });
  });

  app.post("/click/complete", ...middleware, async (req, res) => {
    const body = req.body || {};
    logCallback("complete", body);
    const signFailed = {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      error: ERROR.SIGN_FAILED,
      error_note: "SIGN CHECK FAILED",
    };

    // Signature first, always -- see the note on /click/prepare above.
    if (!secretKey || !verifyCompleteSign(body, secretKey)) {
      logSignFailure("complete", body, secretKey);
      const overLimit = tooManyBadSigns(req.ip);
      recordBadSign(req.ip);
      return res.status(overLimit ? 429 : 200).json(signFailed);
    }

    const envelopeProblem = wrongEnvelope(body, ACTION_COMPLETE);
    if (envelopeProblem) {
      console.warn(`Click complete rejected (${envelopeProblem}) for ${body.merchant_trans_id}`);
      return res.json(signFailed);
    }

    const order = await getOrder(body.merchant_trans_id);
    if (!order) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.TRANSACTION_NOT_FOUND,
        error_note: "Order not found",
      });
    }
    if (order.status === "paid") {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_confirm_id: body.merchant_trans_id,
        error: ERROR.ALREADY_PAID,
        error_note: "Already paid",
      });
    }
    // Same amount check Prepare already does -- the signature covers the
    // amount, so this can't be tampered with by an outsider, but re-checking
    // here means a mismatch is caught before anything is marked paid and a
    // paid feature is handed out for the wrong price.
    if (Number(body.amount) !== order.amount) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.AMOUNT_MISMATCH,
        error_note: "Incorrect amount",
      });
    }
    if (Number(body.error) < 0) {
      await markOrder(body.merchant_trans_id, order.status, "cancelled");
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.TRANSACTION_CANCELLED,
        error_note: "Transaction cancelled",
      });
    }

    // The status transition is what guards against double delivery: if two
    // Completes arrive at once, only one of them moves the row off its
    // current status, and only that one gets a row back to hand to onPaid.
    const paidOrder = await markOrder(body.merchant_trans_id, order.status, "paid", {
      clickTransId: body.click_trans_id,
    });
    if (!paidOrder) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_confirm_id: body.merchant_trans_id,
        error: ERROR.ALREADY_PAID,
        error_note: "Already paid",
      });
    }

    // Click still gets a success response either way -- the money genuinely
    // was taken, and telling it otherwise would make it reverse the payment.
    // A failure here only means the feature hasn't been handed over YET: the
    // order stays flagged undelivered and the retry sweep finishes the job.
    await deliverOrder(body.merchant_trans_id, paidOrder, onPaid);

    return res.json({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_confirm_id: body.merchant_trans_id,
      error: ERROR.SUCCESS,
      error_note: "Success",
    });
  });
}

module.exports = {
  clickConfigProblem,
  registerClickRoutes,
  buildCheckoutUrl,
  verifyPrepareSign,
  verifyCompleteSign,
  // Re-exported from orders.js so the many existing `require("./click")`
  // call sites around the app keep working unchanged. orders.js is the
  // single definition; these are just the door they already knock on.
  createOrder,
  getSalesSummary,
  getSalesRows,
  retryUndeliveredOrders,
  extendFrom,
  priceForType,
  PREMIUM_PRICE_SOM,
  PREMIUM_DAYS,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  ANON_GENDER_DAYS,
};
