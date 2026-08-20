// Payme (Paycom) Merchant API.
//
// Protocol differences from Click that matter, all of them a source of real
// bugs if missed:
//   * JSON-RPC 2.0 on ONE endpoint, not two REST-ish ones
//   * authentication is HTTP Basic with the merchant key, not a per-request
//     signature
//   * amounts are in TIYIN, not so'm (1 so'm = 100 tiyin) -- an order priced
//     9 900 so'm must be checked against 990 000 tiyin
//   * a transaction has its own lifecycle (created -> performed / cancelled)
//     that Payme tracks by ITS id, separate from our order
//   * timestamps are milliseconds since epoch
//
// What is being bought, and what it costs, is NOT decided here: that is the
// shared ledger in orders.js, the same one Click settles against. This file
// owns only Payme's protocol.
const crypto = require("crypto");
const {
  getOrder,
  markOrder,
  deliverOrder,
  priceForType,
} = require("./orders");
const {
  getPaymeTransaction,
  getPaymeTransactionByOrder,
  createPaymeTransaction,
  setPaymeTransactionState,
  listPaymeTransactions,
} = require("./db");

// https://developer.help.paycom.uz/ -- Merchant API error codes.
const ERROR = {
  // -32300..-32000 are transport/JSON-RPC level.
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  CANNOT_CANCEL: -31007,
  // -31050..-31099 is the range reserved for account (order) problems.
  ORDER_NOT_FOUND: -31050,
  ORDER_ALREADY_PAID: -31051,
  INSUFFICIENT_PRIVILEGE: -32504,
  METHOD_NOT_FOUND: -32601,
};

// Payme's transaction states.
const STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED_BEFORE_PERFORM: -1,
  CANCELLED_AFTER_PERFORM: -2,
};

// Payme quotes every amount in tiyin. Getting this wrong by a factor of 100
// is the single most expensive mistake available in this file, in both
// directions, so the conversion lives in exactly one place.
const TIYIN_PER_SOM = 100;
const somToTiyin = (som) => Math.round(Number(som) * TIYIN_PER_SOM);

// Which key inside params.account carries our order id. Payme fixes this per
// merchant when the cash-box is set up, and it is NOT always "order_id" --
// so it is configurable rather than assumed.
const ACCOUNT_FIELD = process.env.PAYME_ACCOUNT_FIELD || "order_id";

function isConfigured() {
  return Boolean(process.env.PAYME_MERCHANT_ID) && configuredKeys().length > 0;
}

// Where the checkout page lives.
//
// Payme issues a merchant TWO key pairs -- one for their sandbox and one for
// real money -- and each only works against its own checkout host. Testing
// with the sandbox key against the live host fails in a way that looks like a
// bad key rather than the wrong environment, so the host is configurable
// instead of assumed.
//
// The default is production, because that is what a deployment without this
// variable set should mean. Point PAYME_CHECKOUT_URL at Payme's sandbox host
// while testing, then remove it to go live.
const CHECKOUT_URL = (process.env.PAYME_CHECKOUT_URL || "https://checkout.paycom.uz").replace(/\/+$/, "");

function isTestCheckout() {
  return /test/i.test(CHECKOUT_URL);
}

// The checkout page. Payme takes one base64 blob rather than query params:
//   m=<merchant id>;ac.<account field>=<order id>;a=<amount in tiyin>
function buildCheckoutUrl(merchantTransId, amountSom) {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  if (!merchantId) return null;
  const payload = `m=${merchantId};ac.${ACCOUNT_FIELD}=${merchantTransId};a=${somToTiyin(amountSom)}`;
  return `${CHECKOUT_URL}/${Buffer.from(payload).toString("base64")}`;
}

// --- authentication ----------------------------------------------------------

// Basic auth, username "Paycom", password = the merchant key. Compared in
// constant time for the same reason Click's signature is: a plain === leaks,
// through response timing, how many leading characters were right.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Payme's own sandbox authenticates its test requests with a DIFFERENT key
// than production does -- their support message ("мои запросы не могут вас
// авторизоваться через песочницу") is exactly this: PAYME_KEY held the
// production key while PAYME_CHECKOUT_URL still pointed at the sandbox, so
// every test call was rejected before it ever reached the merchant logic.
// Both keys are accepted here, whichever is configured, so nothing has to
// be swapped out (and re-broken) the moment Payme approves the merchant and
// production calls start arriving carrying the other one.
function configuredKeys() {
  return [process.env.PAYME_KEY, process.env.PAYME_TEST_KEY].filter(Boolean);
}

function authorised(req) {
  const keys = configuredKeys();
  if (keys.length === 0) return false;

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  // Split on the FIRST colon only -- a key containing one must still work.
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  const password = decoded.slice(separator + 1);

  // Every candidate key is checked -- stopping at the first non-match would
  // still take the same time either way here (there are at most two), so
  // this doesn't reopen the timing side-channel timingSafeEqualStr exists
  // to close.
  return keys.some((key) => timingSafeEqualStr(password, key));
}

// --- JSON-RPC plumbing -------------------------------------------------------

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    // Payme shows these to a payer, so all three languages are supplied.
    message: typeof message === "string" ? { uz: message, ru: message, en: message } : message,
    ...(data ? { data } : {}),
  },
});

const ORDER_NOT_FOUND_MSG = {
  uz: "Buyurtma topilmadi",
  ru: "Заказ не найден",
  en: "Order not found",
};
const WRONG_AMOUNT_MSG = {
  uz: "Noto'g'ri summa",
  ru: "Неверная сумма",
  en: "Incorrect amount",
};

// Reads our order id out of params.account, whatever the configured field is
// called. Returns null rather than throwing on any shape we did not expect.
function orderIdFrom(params) {
  const account = params && params.account;
  if (!account || typeof account !== "object") return null;
  const raw = account[ACCOUNT_FIELD];
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).trim();
  return value || null;
}

// The one question both CheckPerformTransaction and CreateTransaction have to
// answer before anything else: is this a real, still-payable order, and is
// the amount right? Returns an error response, or the order.
async function resolvePayableOrder(id, params) {
  const orderId = orderIdFrom(params);
  if (!orderId) return { error: fail(id, ERROR.ORDER_NOT_FOUND, ORDER_NOT_FOUND_MSG) };

  const order = await getOrder(orderId);
  if (!order) return { error: fail(id, ERROR.ORDER_NOT_FOUND, ORDER_NOT_FOUND_MSG) };
  if (order.status === "paid") {
    return { error: fail(id, ERROR.ORDER_ALREADY_PAID, {
      uz: "Buyurtma allaqachon to'langan",
      ru: "Заказ уже оплачен",
      en: "Order already paid",
    }) };
  }

  // The amount is compared against the price the SERVER decided for this
  // order type. params.amount arrives from Payme already in tiyin, so the
  // stored so'm price is converted up rather than the request converted down
  // -- dividing a request value would let a fractional amount round into a
  // match. Nothing here trusts a number from the request.
  if (Number(params.amount) !== somToTiyin(order.amount)) {
    return { error: fail(id, ERROR.INVALID_AMOUNT, WRONG_AMOUNT_MSG) };
  }

  return { order, orderId };
}

// --- the six methods ---------------------------------------------------------

async function checkPerformTransaction(id, params) {
  const resolved = await resolvePayableOrder(id, params);
  if (resolved.error) return resolved.error;
  return ok(id, { allow: true });
}

async function createTransaction(id, params) {
  const paymeId = String(params.id || "");
  if (!paymeId) return fail(id, ERROR.TRANSACTION_NOT_FOUND, "Transaction id missing");

  // Payme retries CreateTransaction with the same id; the retry must return
  // the SAME transaction rather than making a second one.
  const existing = await getPaymeTransaction(paymeId);
  if (existing) {
    if (existing.state !== STATE.CREATED) {
      return fail(id, ERROR.CANNOT_PERFORM, "Transaction is no longer creatable");
    }
    return ok(id, {
      create_time: Number(existing.createTime),
      transaction: existing.paymeId,
      state: existing.state,
    });
  }

  const resolved = await resolvePayableOrder(id, params);
  if (resolved.error) return resolved.error;

  // One order, one live Payme transaction. Without this a second checkout
  // opened on the same order could be performed after the first, taking the
  // money twice for one purchase.
  const openOnOrder = await getPaymeTransactionByOrder(resolved.orderId);
  if (openOnOrder && openOnOrder.state === STATE.CREATED) {
    return fail(id, ERROR.CANNOT_PERFORM, "Another transaction is already open on this order");
  }

  const createTime = Date.now();
  await createPaymeTransaction({
    paymeId,
    merchantTransId: resolved.orderId,
    amountTiyin: somToTiyin(resolved.order.amount),
    state: STATE.CREATED,
    createTime,
  });

  return ok(id, { create_time: createTime, transaction: paymeId, state: STATE.CREATED });
}

async function performTransaction(id, params, onPaid) {
  const paymeId = String(params.id || "");
  const tx = await getPaymeTransaction(paymeId);
  if (!tx) return fail(id, ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");

  // Already performed: Payme is retrying, and the correct answer is the same
  // successful result as the first time -- NOT a second delivery.
  if (tx.state === STATE.PERFORMED) {
    return ok(id, {
      transaction: tx.paymeId,
      perform_time: Number(tx.performTime),
      state: tx.state,
    });
  }
  if (tx.state !== STATE.CREATED) {
    return fail(id, ERROR.CANNOT_PERFORM, "Transaction is cancelled");
  }

  const performTime = Date.now();
  await setPaymeTransactionState(paymeId, STATE.PERFORMED, { performTime });

  // The order status transition is what actually guards delivery, exactly as
  // it does for Click: only the caller that moves the row off its previous
  // status gets a row back, so concurrent Performs cannot both deliver.
  const order = await getOrder(tx.merchantTransId);
  if (order && order.status !== "paid") {
    const paidOrder = await markOrder(tx.merchantTransId, order.status, "paid", {});
    if (paidOrder) await deliverOrder(tx.merchantTransId, paidOrder, onPaid);
  }

  return ok(id, { transaction: tx.paymeId, perform_time: performTime, state: STATE.PERFORMED });
}

async function cancelTransaction(id, params) {
  const paymeId = String(params.id || "");
  const tx = await getPaymeTransaction(paymeId);
  if (!tx) return fail(id, ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");

  // Already cancelled: repeat the same answer rather than cancelling twice.
  if (tx.state === STATE.CANCELLED_BEFORE_PERFORM || tx.state === STATE.CANCELLED_AFTER_PERFORM) {
    return ok(id, {
      transaction: tx.paymeId,
      cancel_time: Number(tx.cancelTime),
      state: tx.state,
    });
  }

  // Which cancelled state applies depends on whether the money was taken:
  // -1 if it never was, -2 if this is a reversal of a completed payment.
  const state = tx.state === STATE.PERFORMED ? STATE.CANCELLED_AFTER_PERFORM : STATE.CANCELLED_BEFORE_PERFORM;
  const cancelTime = Date.now();
  await setPaymeTransactionState(paymeId, state, { cancelTime, reason: params.reason ?? null });

  // The order goes back to being unpaid. Whatever was already granted is
  // deliberately NOT clawed back here: taking away access somebody has been
  // using is a business decision, not something a callback should do
  // silently. A reversal is visible in the admin panel and in the logs.
  const order = await getOrder(tx.merchantTransId);
  if (order && order.status !== "cancelled") {
    await markOrder(tx.merchantTransId, order.status, "cancelled", {});
  }
  if (state === STATE.CANCELLED_AFTER_PERFORM) {
    console.warn(
      `Payme REVERSED a completed payment: order ${tx.merchantTransId}, ` +
        `transaction ${paymeId}, reason ${params.reason ?? "n/a"} -- access already granted was left in place.`
    );
  }

  return ok(id, { transaction: tx.paymeId, cancel_time: cancelTime, state });
}

async function checkTransaction(id, params) {
  const tx = await getPaymeTransaction(String(params.id || ""));
  if (!tx) return fail(id, ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");
  return ok(id, {
    create_time: Number(tx.createTime) || 0,
    perform_time: Number(tx.performTime) || 0,
    cancel_time: Number(tx.cancelTime) || 0,
    transaction: tx.paymeId,
    state: tx.state,
    reason: tx.reason ?? null,
  });
}

async function getStatement(id, params) {
  const from = Number(params.from) || 0;
  const to = Number(params.to) || Date.now();
  const rows = await listPaymeTransactions(from, to);
  return ok(id, {
    transactions: rows.map((tx) => ({
      id: tx.paymeId,
      time: Number(tx.createTime) || 0,
      amount: Number(tx.amountTiyin) || 0,
      account: { [ACCOUNT_FIELD]: tx.merchantTransId },
      create_time: Number(tx.createTime) || 0,
      perform_time: Number(tx.performTime) || 0,
      cancel_time: Number(tx.cancelTime) || 0,
      transaction: tx.paymeId,
      state: tx.state,
      reason: tx.reason ?? null,
    })),
  });
}

// --- route -------------------------------------------------------------------

function registerPaymeRoutes(app, { onPaid, bodyParser } = {}) {
  const middleware = bodyParser ? [bodyParser] : [];

  app.post("/payme", ...middleware, async (req, res) => {
    const body = req.body || {};
    const id = body.id ?? null;

    // Authentication before anything else, exactly as with Click's signature.
    // Note this is checked even when Payme is not configured at all: an
    // unconfigured deployment must reject callbacks, not accept them.
    if (!authorised(req)) {
      return res.json(fail(id, ERROR.INSUFFICIENT_PRIVILEGE, "Insufficient privilege to perform this method"));
    }

    const params = body.params || {};
    try {
      switch (body.method) {
        case "CheckPerformTransaction":
          return res.json(await checkPerformTransaction(id, params));
        case "CreateTransaction":
          return res.json(await createTransaction(id, params));
        case "PerformTransaction":
          return res.json(await performTransaction(id, params, onPaid));
        case "CancelTransaction":
          return res.json(await cancelTransaction(id, params));
        case "CheckTransaction":
          return res.json(await checkTransaction(id, params));
        case "GetStatement":
          return res.json(await getStatement(id, params));
        default:
          return res.json(fail(id, ERROR.METHOD_NOT_FOUND, "Method not found"));
      }
    } catch (err) {
      // Never leak an internal error to a payment provider -- and never
      // return a shape it cannot parse, which would make it retry forever.
      console.error(`Payme ${body.method} failed:`, err);
      return res.json(fail(id, ERROR.CANNOT_PERFORM, "Internal error"));
    }
  });
}

module.exports = {
  registerPaymeRoutes,
  buildCheckoutUrl,
  isTestCheckout,
  ACCOUNT_FIELD,
  isConfigured,
  somToTiyin,
  ERROR,
  STATE,
  __test: { authorised, orderIdFrom, ACCOUNT_FIELD },
};
