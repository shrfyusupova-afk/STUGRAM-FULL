// The order ledger, shared by every payment provider.
//
// What a person is buying, who they are, and what it costs are the same
// facts whichever provider settles the money -- only the settlement protocol
// differs. Keeping that here means Click and Payme cannot drift apart on the
// part that actually decides what gets granted, and a second provider does
// not get a second, subtly different idea of what an order is.
//
// Providers own only their own protocol: signatures/auth, their callback
// shapes, and their own transaction records.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// Ledger backend: present only when Postgres is active (see db.js).
const { txStore } = require("./db");

const TX_PATH = path.join(__dirname, "..", "data", "clickTransactions.json");

// --- prices ------------------------------------------------------------------
//
// The single source of truth for what anything costs. Every checkout reads
// the price from here; nothing ever takes an amount from a client request.
const PREMIUM_PRICE_SOM = 79900;
const PREMIUM_DAYS = 30;
const UNLOCK_PRICE_SOM = 9900;
const VIP_CHAT_PRICE_SOM = 21900;
const ANON_GENDER_PRICE_SOM = 12900;
const ANON_GENDER_DAYS = 7;

// The ForResult board is the one thing here with no fixed price: the buyer
// names the amount, because the amount IS the product -- it decides their
// place in the ranking. That makes it the single exception to "nothing ever
// takes an amount from a client request", so it gets its own explicit list
// rather than a general "trust the caller's amount" flag. Anything not named
// here is priced from the constants above no matter what a caller passes,
// so a bug in a fixed-price call site can never change what Premium costs.
const VARIABLE_PRICE_TYPES = new Set(["adboard"]);

// Bounds on a named amount. The floor keeps the board from filling with
// 100-so'm entries that cost more in payment fees than they bring in; the
// ceiling is a typo guard -- somebody meaning 50 000 who holds the 0 key is
// otherwise charged tens of millions.
const AD_MIN_SOM = 5000;
const AD_MAX_SOM = 100000000;

function isValidAdAmount(som) {
  return Number.isInteger(som) && som >= AD_MIN_SOM && som <= AD_MAX_SOM;
}

function priceForType(type, requestedSom) {
  if (VARIABLE_PRICE_TYPES.has(type)) {
    if (!isValidAdAmount(Number(requestedSom))) {
      throw new Error(`Invalid amount for ${type}: ${requestedSom}`);
    }
    return Number(requestedSom);
  }
  if (type === "unlock") return UNLOCK_PRICE_SOM;
  if (type === "vipchat") return VIP_CHAT_PRICE_SOM;
  if (type === "anongender") return ANON_GENDER_PRICE_SOM;
  return PREMIUM_PRICE_SOM;
}

// Adding time to a subscription starts from whatever is LEFT on it, not from
// today -- otherwise renewing early silently throws away every remaining day,
// so the person effectively pays to lose time. Shared by every provider's
// delivery path and the admin panel's "gift" buttons so they cannot drift.
function extendFrom(currentUntilIso, days) {
  const now = Date.now();
  const current = currentUntilIso ? new Date(currentUntilIso).getTime() : 0;
  const base = Number.isFinite(current) && current > now ? current : now;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

// --- JSON fallback -----------------------------------------------------------
//
// Used only when there is no DATABASE_URL. Null-prototype, not plain {}:
// merchant_trans_id arrives from a provider's request and is used as a lookup
// key here, so a key like "__proto__" must behave like any other unknown key
// instead of hitting the special exotic accessor plain objects have.
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

// Temp-file + rename -- a torn write here would corrupt the payment ledger,
// losing the record of who paid for what.
function writeTx(all) {
  fs.mkdirSync(path.dirname(TX_PATH), { recursive: true });
  const tmpPath = `${TX_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(all, null, 2));
  fs.renameSync(tmpPath, TX_PATH);
}

// --- ledger access, routed to whichever storage backend is active ------------

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

async function getOrder(merchantTransId) {
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

// Moves an order from one status to another, returning the updated row ONLY
// if it was still in `fromStatus`. That makes the transition the single point
// of truth for idempotency: a provider retries its callback, the retry finds
// the row already 'paid', matches nothing, and so cannot deliver twice.
async function markOrder(merchantTransId, fromStatus, toStatus, extra = {}) {
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

// Every settled order of one kind, in full, newest first. getSalesRows returns
// only type and amount because a total needs nothing else; this is what the
// admin screen showing individual payments reads.
async function listPaidOrders(type, sinceIso, limit = 50) {
  if (txStore) return txStore.listPaidOrdersByType(type, sinceIso, limit);
  return Object.entries(readTx())
    .filter(
      ([, tx]) =>
        tx.status === "paid" && tx.type === type && (!sinceIso || (tx.paidAt && tx.paidAt >= sinceIso))
    )
    .map(([merchantTransId, tx]) => ({ merchantTransId, ...tx }))
    .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))
    .slice(0, limit);
}

// --- creating an order -------------------------------------------------------

// `provider` records which checkout the person was sent to. It does NOT
// restrict who may settle the order: somebody can open a Click checkout,
// change their mind and pay with Payme instead, and that must work. It is
// there for reporting, and so a reused pending order can be re-pointed.
//
// `amountSom` is honoured ONLY for the variable-price types listed above
// (the ForResult board, where the buyer names the figure because the
// figure is what they are buying). For everything else it is ignored
// entirely and the price comes from the constants, so a call site passing a
// wrong amount can never change what Premium costs.
async function createOrder(userId, { type = "premium", targetId, provider = "click", amountSom } = {}) {
  const amount = priceForType(type, amountSom);

  // Reopening the same paywall without paying (e.g. tapping the paywall link
  // again) reuses the still-pending order instead of piling up an abandoned
  // row every time -- the ledger would otherwise grow forever. It is also
  // what lets the Click and Payme buttons on the SAME screen refer to one
  // order rather than two competing ones.
  const existing = await findPendingOrder(userId, type, targetId);
  if (existing) {
    // The checkout URL is always built from the CURRENT price constant, but a
    // reused pending order still carries whatever the price was when it was
    // first opened. If a price ever changes between those two moments, the
    // provider sends the new amount while the callback compares against the
    // old stored one and rejects the payment. Re-sync so a price change can
    // never strand someone mid-checkout.
    if (existing.amount !== amount) await updateTransactionAmount(existing.merchantTransId, amount);
    return existing.merchantTransId;
  }

  // Unguessable and carrying no user data. Never parsed anywhere: orders are
  // found by exact id, or by (user, type, target).
  const merchantTransId = `${type}_${crypto.randomBytes(12).toString("hex")}`;
  await createTransaction(merchantTransId, {
    userId: String(userId),
    type,
    ...(targetId ? { targetId: String(targetId) } : {}),
    amount,
    status: "pending",
    provider,
  });
  return merchantTransId;
}

// --- delivery tracking -------------------------------------------------------
//
// "Paid" and "the buyer actually got what they paid for" are different facts.
// A provider is told success as soon as the money is confirmed (it must be,
// or it keeps retrying and eventually reverses), but granting the feature can
// still fail afterwards. Recording delivery separately is what makes that
// failure recoverable instead of a silent loss.

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

// Enough retries to ride out a long outage, few enough that a permanently
// undeliverable order stops being retried forever.
const MAX_DELIVERY_ATTEMPTS = 10;

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

// Hands the feature over and records that it happened, or leaves the order
// flagged for the retry sweep. Shared so every provider settles an order in
// exactly the same way -- the step where a difference between providers would
// mean one of them silently failing to deliver what was paid for.
async function deliverOrder(merchantTransId, paidOrder, onPaid) {
  if (!onPaid) {
    // No handler configured at all; nothing to deliver, so don't leave the
    // order looking like it's owed something.
    await markDelivered(merchantTransId);
    return;
  }
  try {
    await onPaid({ merchantTransId, ...paidOrder });
    await markDelivered(merchantTransId);
  } catch (err) {
    await bumpDeliveryAttempts(merchantTransId).catch(() => {});
    console.error(`Delivery failed for ${merchantTransId} -- order kept for retry:`, err.message);
  }
}

// Premium is the DEFAULT bucket here -- it takes everything not claimed by a
// named type -- so every new product has to be named in this list as well as
// given its own line. Miss one and its income is silently reported as Premium
// revenue, which is exactly what happened to the ForResult board until this
// list caught up with it.
const SALES_TYPES = ["unlock", "vipchat", "anongender", "adboard"];

async function getSalesSummary(sinceIso) {
  const paid = await getSalesRows(sinceIso);
  const bucket = (rows) => ({
    count: rows.length,
    totalRevenue: rows.reduce((sum, tx) => sum + tx.amount, 0),
  });
  return {
    premium: bucket(paid.filter((tx) => !SALES_TYPES.includes(tx.type))),
    unlock: bucket(paid.filter((tx) => tx.type === "unlock")),
    vipchat: bucket(paid.filter((tx) => tx.type === "vipchat")),
    anongender: bucket(paid.filter((tx) => tx.type === "anongender")),
    adboard: bucket(paid.filter((tx) => tx.type === "adboard")),
  };
}

module.exports = {
  // prices
  priceForType,
  extendFrom,
  PREMIUM_PRICE_SOM,
  PREMIUM_DAYS,
  UNLOCK_PRICE_SOM,
  VIP_CHAT_PRICE_SOM,
  ANON_GENDER_PRICE_SOM,
  ANON_GENDER_DAYS,
  AD_MIN_SOM,
  AD_MAX_SOM,
  isValidAdAmount,
  // ledger
  createOrder,
  getOrder,
  markOrder,
  findPendingOrder,
  updateTransactionAmount,
  // delivery
  deliverOrder,
  markDelivered,
  bumpDeliveryAttempts,
  listUndeliveredOrders,
  retryUndeliveredOrders,
  MAX_DELIVERY_ATTEMPTS,
  // reporting
  getSalesRows,
  getSalesSummary,
  listPaidOrders,
};
