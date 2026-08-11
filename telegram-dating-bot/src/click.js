const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// Ledger backend: present only when Postgres is active (see db.js).
const { txStore } = require("./db");

const TX_PATH = path.join(__dirname, "..", "data", "clickTransactions.json");

// Null-prototype, not plain {} -- merchant_trans_id in Click's
// Prepare/Complete requests is echoed straight back to us and used as a
// lookup key here; a null-prototype object means a key like "__proto__"
// just behaves like any other unknown key instead of hitting the special
// exotic accessor that plain objects have.
function readTx() {
  if (!fs.existsSync(TX_PATH)) return Object.create(null);
  try {
    return Object.assign(Object.create(null), JSON.parse(fs.readFileSync(TX_PATH, "utf8")));
  } catch (err) {
    // Keep the damaged ledger so paid orders can still be reconciled by hand,
    // rather than letting the next write silently overwrite it with nothing.
    const backup = `${TX_PATH}.corrupt`;
    try {
      if (!fs.existsSync(backup)) fs.copyFileSync(TX_PATH, backup);
    } catch (copyErr) {
      console.error("Could not preserve corrupt transaction file:", copyErr.message);
    }
    console.error(`CORRUPT TRANSACTION FILE (copy kept at ${backup}):`, err.message);
    return Object.create(null);
  }
}

// Temp-file + rename, same as db.js's writeJson -- a torn write here would
// corrupt the payment ledger, losing the record of who paid for what.
function writeTx(all) {
  fs.mkdirSync(path.dirname(TX_PATH), { recursive: true });
  const tmpPath = `${TX_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(all, null, 2));
  fs.renameSync(tmpPath, TX_PATH);
}

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

const PREMIUM_PRICE_SOM = 79900;
const PREMIUM_DAYS = 30;
const UNLOCK_PRICE_SOM = 9900;
const VIP_CHAT_PRICE_SOM = 59900;
const ANON_GENDER_PRICE_SOM = 12900;
const ANON_GENDER_DAYS = 7;

// Adding time to a subscription starts from whatever is LEFT on it, not from
// today -- otherwise renewing early silently throws away every remaining day,
// so the person effectively pays to lose time. Shared by the Click delivery
// path and the admin panel's "gift" buttons so the two cannot drift apart.
function extendFrom(currentUntilIso, days) {
  const now = Date.now();
  const current = currentUntilIso ? new Date(currentUntilIso).getTime() : 0;
  const base = Number.isFinite(current) && current > now ? current : now;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function priceForType(type) {
  if (type === "unlock") return UNLOCK_PRICE_SOM;
  if (type === "vipchat") return VIP_CHAT_PRICE_SOM;
  if (type === "anongender") return ANON_GENDER_PRICE_SOM;
  return PREMIUM_PRICE_SOM;
}

// --- Ledger access, routed to whichever storage backend is active ---------
//
// With Postgres the ledger lives in click_transactions; otherwise it stays in
// the original JSON file. Both paths go through these six helpers so the
// payment logic below is written once.

async function findPendingOrder(userId, type, targetId) {
  if (txStore) return txStore.findPendingOrder(userId, type, targetId);
  const all = readTx();
  const id = Object.keys(all).find((key) => {
    const tx = all[key];
    return (
      tx.status === "pending" &&
      tx.userId === String(userId) &&
      tx.type === type &&
      (type !== "unlock" || tx.targetId === String(targetId))
    );
  });
  return id ? { merchantTransId: id, ...all[id] } : null;
}

async function getTransaction(merchantTransId) {
  if (txStore) return txStore.getTransaction(merchantTransId);
  return readTx()[merchantTransId] || null;
}

async function createTransaction(merchantTransId, tx) {
  if (txStore) return txStore.createTransaction(merchantTransId, tx);
  const all = readTx();
  all[merchantTransId] = { ...tx, createdAt: new Date().toISOString() };
  writeTx(all);
}

async function updateTransactionAmount(merchantTransId, amount) {
  if (txStore) return txStore.updateTransactionAmount(merchantTransId, amount);
  const all = readTx();
  if (!all[merchantTransId]) return;
  all[merchantTransId].amount = amount;
  writeTx(all);
}

// Moves a transaction from one status to another, returning the updated row
// ONLY if it was still in `fromStatus`. That makes the transition the single
// point of truth for idempotency: Click retries Complete, and the retry finds
// the row already 'paid', matches nothing, and so cannot deliver twice.
async function markTransaction(merchantTransId, fromStatus, toStatus, extra = {}) {
  if (txStore) return txStore.markTransaction(merchantTransId, fromStatus, toStatus, extra);
  const all = readTx();
  const order = all[merchantTransId];
  if (!order || order.status !== fromStatus) return null;
  order.status = toStatus;
  if (extra.clickTransId) order.clickTransId = extra.clickTransId;
  if (toStatus === "paid") order.paidAt = new Date().toISOString();
  writeTx(all);
  return { ...order };
}

async function getSalesRows(sinceIso) {
  if (txStore) return txStore.getSalesRows(sinceIso);
  return Object.values(readTx())
    .filter((tx) => tx.status === "paid" && (!sinceIso || (tx.paidAt && tx.paidAt >= sinceIso)))
    .map((tx) => ({ type: tx.type, amount: tx.amount }));
}

// --- Delivery tracking -----------------------------------------------------
//
// "Paid" and "the buyer actually got what they paid for" are different facts.
// Click is told success as soon as the money is confirmed (it must be, or it
// keeps retrying and eventually reverses), but granting the feature can still
// fail afterwards. Recording delivery separately is what makes that failure
// recoverable instead of a silent loss -- Click never asks again.

async function listUndeliveredOrders(limit = 50) {
  if (txStore) return txStore.listUndeliveredOrders(limit);
  return Object.entries(readTx())
    .filter(([, tx]) => tx.status === "paid" && !tx.delivered)
    .slice(0, limit)
    .map(([merchantTransId, tx]) => ({ merchantTransId, ...tx, deliveryAttempts: tx.deliveryAttempts || 0 }));
}

async function markDelivered(merchantTransId) {
  if (txStore) return txStore.markDelivered(merchantTransId);
  const all = readTx();
  if (!all[merchantTransId]) return;
  all[merchantTransId].delivered = true;
  writeTx(all);
}

async function bumpDeliveryAttempts(merchantTransId) {
  if (txStore) return txStore.bumpDeliveryAttempts(merchantTransId);
  const all = readTx();
  if (!all[merchantTransId]) return 0;
  all[merchantTransId].deliveryAttempts = (all[merchantTransId].deliveryAttempts || 0) + 1;
  writeTx(all);
  return all[merchantTransId].deliveryAttempts;
}

// Give up eventually rather than retrying a permanently broken order forever
// (a deleted account, say). The order stays flagged undelivered so it can
// still be found and settled by hand.
const MAX_DELIVERY_ATTEMPTS = 10;

// Runs the pending deliveries. Called right after startup and then on a timer,
// so a purchase that failed to land during an outage is completed as soon as
// the bot is healthy again.
async function retryUndeliveredOrders(onPaid) {
  if (!onPaid) return { retried: 0, delivered: 0 };
  let delivered = 0;
  let retried = 0;
  let orders;
  try {
    orders = await listUndeliveredOrders();
  } catch (err) {
    console.error("Could not list undelivered orders:", err.message);
    return { retried: 0, delivered: 0 };
  }

  for (const order of orders) {
    if ((order.deliveryAttempts || 0) >= MAX_DELIVERY_ATTEMPTS) continue;
    retried++;
    try {
      await onPaid(order);
      await markDelivered(order.merchantTransId);
      delivered++;
      console.log(`Recovered undelivered order ${order.merchantTransId} (${order.type}, user ${order.userId})`);
    } catch (err) {
      const attempts = await bumpDeliveryAttempts(order.merchantTransId);
      console.error(
        `Delivery retry ${attempts}/${MAX_DELIVERY_ATTEMPTS} failed for ${order.merchantTransId}:`,
        err.message
      );
    }
  }
  if (retried) console.log(`Delivery sweep: ${delivered}/${retried} recovered.`);
  return { retried, delivered };
}

// type: "premium" (subscription), "unlock" (pay once to view a single
// candidate's contact), "vipchat" (pay once to join the VIP chat group, men
// only -- women join free), or "anongender" (weekly subscription to pick a
// specific gender in anonymous chat instead of random). targetId is only
// meaningful for "unlock" -- it's the candidate profile the payment grants
// access to.
async function createOrder(userId, { type = "premium", targetId } = {}) {
  const amount = priceForType(type);

  // Reopening the same paywall without paying (e.g. tapping the paywall link
  // again) reuses the still-pending order instead of piling up an abandoned
  // row every time -- the ledger would otherwise grow forever.
  const existing = await findPendingOrder(userId, type, targetId);
  if (existing) {
    // The checkout URL is always built from the CURRENT price constant, but a
    // reused pending order still carries whatever the price was when it was
    // first opened. If a price ever changes between those two moments, Click
    // sends the new amount while Prepare compares against the old stored one
    // and rejects the whole payment with AMOUNT_MISMATCH. Re-sync it here so
    // a price change can never strand someone mid-checkout.
    if (existing.amount !== amount) await updateTransactionAmount(existing.merchantTransId, amount);
    return existing.merchantTransId;
  }

  const merchantTransId = `${type}_${userId}_${Date.now()}`;
  await createTransaction(merchantTransId, {
    userId: String(userId),
    type,
    ...(targetId ? { targetId: String(targetId) } : {}),
    amount,
    status: "pending",
  });
  return merchantTransId;
}

// Returns null when CLICK_MERCHANT_ID/CLICK_SERVICE_ID aren't configured yet --
// callers should fall back to a "not set up yet" message in that case.
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

// Registers Click's two merchant webhook actions on an existing Express app.
// onPaid(order) is called once, exactly when a transaction first transitions
// to "paid" (guarded against Click's at-least-once delivery). order is the
// full stored record: { userId, type, targetId?, amount, ... }.
function registerClickRoutes(app, { onPaid, bodyParser } = {}) {
  const secretKey = process.env.CLICK_SECRET_KEY;
  const middleware = bodyParser ? [bodyParser] : [];

  app.post("/click/prepare", ...middleware, async (req, res) => {
    const body = req.body || {};
    if (!secretKey || !verifyPrepareSign(body, secretKey)) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.SIGN_FAILED,
        error_note: "SIGN CHECK FAILED",
      });
    }

    const order = await getTransaction(body.merchant_trans_id);
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
    await markTransaction(body.merchant_trans_id, "pending", "prepared", {
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
    if (!secretKey || !verifyCompleteSign(body, secretKey)) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.SIGN_FAILED,
        error_note: "SIGN CHECK FAILED",
      });
    }

    const order = await getTransaction(body.merchant_trans_id);
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
      await markTransaction(body.merchant_trans_id, order.status, "cancelled");
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
    const paidOrder = await markTransaction(body.merchant_trans_id, order.status, "paid", {
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
    if (onPaid) {
      try {
        await onPaid({ merchantTransId: body.merchant_trans_id, ...paidOrder });
        await markDelivered(body.merchant_trans_id);
      } catch (err) {
        await bumpDeliveryAttempts(body.merchant_trans_id).catch(() => {});
        console.error(
          `Click onPaid failed for ${body.merchant_trans_id} -- order kept for retry:`,
          err.message
        );
      }
    } else {
      // No handler configured at all; nothing to deliver, so don't leave the
      // order looking like it's owed something.
      await markDelivered(body.merchant_trans_id);
    }

    return res.json({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_confirm_id: body.merchant_trans_id,
      error: ERROR.SUCCESS,
      error_note: "Success",
    });
  });
}

async function getSalesSummary(sinceIso) {
  const paid = await getSalesRows(sinceIso);
  const specialTypes = ["unlock", "vipchat", "anongender"];
  const premiumPaid = paid.filter((tx) => !specialTypes.includes(tx.type));
  const unlockPaid = paid.filter((tx) => tx.type === "unlock");
  const vipchatPaid = paid.filter((tx) => tx.type === "vipchat");
  const anongenderPaid = paid.filter((tx) => tx.type === "anongender");
  return {
    premium: { count: premiumPaid.length, totalRevenue: premiumPaid.reduce((sum, tx) => sum + tx.amount, 0) },
    unlock: { count: unlockPaid.length, totalRevenue: unlockPaid.reduce((sum, tx) => sum + tx.amount, 0) },
    vipchat: { count: vipchatPaid.length, totalRevenue: vipchatPaid.reduce((sum, tx) => sum + tx.amount, 0) },
    anongender: { count: anongenderPaid.length, totalRevenue: anongenderPaid.reduce((sum, tx) => sum + tx.amount, 0) },
  };
}

module.exports = {
  createOrder,
  buildCheckoutUrl,
  registerClickRoutes,
  getSalesSummary,
  extendFrom,
  retryUndeliveredOrders,
  verifyPrepareSign,
  verifyCompleteSign,
  PREMIUM_PRICE_SOM,
  PREMIUM_DAYS,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  ANON_GENDER_DAYS,
};
