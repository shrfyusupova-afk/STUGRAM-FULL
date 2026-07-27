const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
  } catch {
    return Object.create(null);
  }
}

function writeTx(all) {
  fs.mkdirSync(path.dirname(TX_PATH), { recursive: true });
  fs.writeFileSync(TX_PATH, JSON.stringify(all, null, 2));
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
const UNLOCK_PRICE_SOM = 7900;
const VIP_CHAT_PRICE_SOM = 59900;
const ANON_GENDER_PRICE_SOM = 12900;
const ANON_GENDER_DAYS = 7;

function priceForType(type) {
  if (type === "unlock") return UNLOCK_PRICE_SOM;
  if (type === "vipchat") return VIP_CHAT_PRICE_SOM;
  if (type === "anongender") return ANON_GENDER_PRICE_SOM;
  return PREMIUM_PRICE_SOM;
}

// type: "premium" (subscription), "unlock" (pay once to view a single
// candidate's contact), "vipchat" (pay once to join the VIP chat group, men
// only -- women join free), or "anongender" (weekly subscription to pick a
// specific gender in anonymous chat instead of random). targetId is only
// meaningful for "unlock" -- it's the candidate profile the payment grants
// access to.
function createOrder(userId, { type = "premium", targetId } = {}) {
  const amount = priceForType(type);
  const all = readTx();

  // Reopening the same paywall without paying (e.g. tapping the paywall link
  // again) reuses the still-pending order instead of piling up an abandoned
  // row every time -- clickTransactions.json would otherwise grow forever.
  const existingId = Object.keys(all).find((id) => {
    const tx = all[id];
    return (
      tx.status === "pending" &&
      tx.userId === String(userId) &&
      tx.type === type &&
      (type !== "unlock" || tx.targetId === String(targetId))
    );
  });
  if (existingId) return existingId;

  const merchantTransId = `${type}_${userId}_${Date.now()}`;
  all[merchantTransId] = {
    userId: String(userId),
    type,
    ...(targetId ? { targetId: String(targetId) } : {}),
    amount,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeTx(all);
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

  app.post("/click/prepare", ...middleware, (req, res) => {
    const body = req.body || {};
    if (!secretKey || !verifyPrepareSign(body, secretKey)) {
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.SIGN_FAILED,
        error_note: "SIGN CHECK FAILED",
      });
    }

    const all = readTx();
    const order = all[body.merchant_trans_id];
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

    order.status = "prepared";
    order.clickTransId = body.click_trans_id;
    writeTx(all);

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

    const all = readTx();
    const order = all[body.merchant_trans_id];
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
    if (Number(body.error) < 0) {
      order.status = "cancelled";
      writeTx(all);
      return res.json({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        error: ERROR.TRANSACTION_CANCELLED,
        error_note: "Transaction cancelled",
      });
    }

    order.status = "paid";
    order.paidAt = new Date().toISOString();
    writeTx(all);

    if (onPaid) {
      try {
        await onPaid(order);
      } catch (err) {
        console.error("Click onPaid handler failed:", err);
      }
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

function getSalesSummary() {
  const all = Object.values(readTx());
  const paid = all.filter((tx) => tx.status === "paid");
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
  verifyPrepareSign,
  verifyCompleteSign,
  PREMIUM_PRICE_SOM,
  PREMIUM_DAYS,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  ANON_GENDER_DAYS,
};
