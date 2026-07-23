const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TX_PATH = path.join(__dirname, "..", "data", "clickTransactions.json");

function readTx() {
  if (!fs.existsSync(TX_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(TX_PATH, "utf8"));
  } catch {
    return {};
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

// Prepare (action=0): md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
function verifyPrepareSign(body, secretKey) {
  const expected = md5(
    `${body.click_trans_id}${body.service_id}${secretKey}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`
  );
  return expected === body.sign_string;
}

// Complete (action=1): same as Prepare but with merchant_prepare_id inserted before amount.
function verifyCompleteSign(body, secretKey) {
  const expected = md5(
    `${body.click_trans_id}${body.service_id}${secretKey}${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`
  );
  return expected === body.sign_string;
}

const PREMIUM_PRICE_SOM = 69000;
const PREMIUM_DAYS = 30;

function createOrder(userId) {
  const merchantTransId = `prem_${userId}_${Date.now()}`;
  const all = readTx();
  all[merchantTransId] = {
    userId: String(userId),
    amount: PREMIUM_PRICE_SOM,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeTx(all);
  return merchantTransId;
}

// Returns null when CLICK_MERCHANT_ID/CLICK_SERVICE_ID aren't configured yet --
// callers should fall back to a "not set up yet" message in that case.
function buildCheckoutUrl(merchantTransId) {
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const serviceId = process.env.CLICK_SERVICE_ID;
  if (!merchantId || !serviceId) return null;

  const params = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(PREMIUM_PRICE_SOM),
    transaction_param: merchantTransId,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

// Registers Click's two merchant webhook actions on an existing Express app.
// onPaid(userId, amountSom) is called once, exactly when a transaction first
// transitions to "paid" (guarded against Click's at-least-once delivery).
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
        await onPaid(order.userId, order.amount);
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
  const totalRevenue = paid.reduce((sum, tx) => sum + tx.amount, 0);
  return { count: paid.length, totalRevenue };
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
};
