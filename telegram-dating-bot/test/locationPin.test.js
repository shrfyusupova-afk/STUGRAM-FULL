// A dropped pin has to become a place name, not a pair of numbers.
//
// The wizard's location step has always had two ways in: type a place name,
// or tap "share my location" and send a GPS pin. Only the typed path ever
// ran through resolveLocation -- a pin was stored as the raw
// "41.311, 69.279" string it arrived as, so every profile filled in that way
// showed coordinates to everyone who looked at it instead of "Chilonzor".
// resolveLocation already had a coordinate branch (nearestPlace within 25km)
// built for exactly this; it just was never wired to the pin path. It is now.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");

const M = () => h.mainBot();

let nextId = 980000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

// Walks the wizard up to and including the location step, then answers it
// with a GPS pin rather than typed text -- the exact tap a real "share my
// location" button sends.
async function registerWithPin(u, lat, lon, name = "PinUser") {
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate(name, u));
  await h.send(M(), h.textUpdate("22", u));
  await h.send(M(), h.callbackUpdate("gender:male", u));
  await h.send(M(), h.photoUpdate(u));
  await h.send(M(), h.locationUpdate(lat, lon, u));
  await h.send(M(), h.textUpdate("Salom", u));
  await h.send(M(), h.contactUpdate(`+9989${u.id}`, u));
  return h.send(M(), h.textUpdate("✅ Ha", u));
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- the stored value ---------------------------------------------------------

test("a pin dropped in Chilonzor is stored as 'Chilonzor', not coordinates", async () => {
  const u = user("PinChilonzor");
  await registerWithPin(u, 41.275, 69.2044);
  const profile = await db.getProfile(u.id);
  assert.strictEqual(profile.location, "Chilonzor");
  assert.ok(!/^\s*-?\d/.test(profile.location), "the stored value must not start with a raw number");
});

test("a pin dropped in central Tashkent resolves to Toshkent", async () => {
  const u = user("PinTashkent");
  await registerWithPin(u, 41.2995, 69.2401);
  const profile = await db.getProfile(u.id);
  assert.strictEqual(profile.location, "Toshkent");
});

test("a pin dropped near Samarqand resolves to Samarqand", async () => {
  const u = user("PinSamarqand");
  await registerWithPin(u, 39.6542, 66.9597);
  const profile = await db.getProfile(u.id);
  assert.strictEqual(profile.location, "Samarqand");
});

// --- the wizard actually advances ---------------------------------------------

test("sending a pin moves the wizard on to the next step, same as typed text", async () => {
  const u = user("PinAdvance");
  const sent = await registerWithPin(u, 41.275, 69.2044);
  // The whole sequence has to complete -- if the location step silently
  // rejected the pin, the wizard would still be stuck on it and none of the
  // later replies (bio, contact, confirm) would be accepted at all.
  const profile = await db.getProfile(u.id);
  assert.ok(profile && profile.name, "registration must actually finish");
});

// --- nobody sees raw numbers on a real card -----------------------------------

test("the profile card shown to someone else never carries a coordinate pair", async () => {
  const her = user("PinCardView");
  await registerWithPin(her, 41.275, 69.2044, "PinCardView");

  const viewer = user("PinCardViewer");
  await h.send(M(), h.commandUpdate("/start", viewer));
  await h.send(M(), h.callbackUpdate("lang:uz", viewer));
  await h.send(M(), h.textUpdate("Viewer", viewer));
  await h.send(M(), h.textUpdate("23", viewer));
  await h.send(M(), h.callbackUpdate("gender:female", viewer));
  await h.send(M(), h.photoUpdate(viewer));
  await h.send(M(), h.textUpdate("Toshkent", viewer));
  await h.send(M(), h.textUpdate("Salom", viewer));
  await h.send(M(), h.contactUpdate(`+9989${viewer.id}`, viewer));
  await h.send(M(), h.textUpdate("✅ Ha", viewer));

  let sent = await h.send(M(), h.textUpdate("🔍 Yangi tanishuvlar", viewer));
  for (let i = 0; i < 20; i++) {
    const card = sent.find((c) => c.method === "sendPhoto");
    const caption = card ? card.payload.caption || "" : "";
    if (caption.includes("PinCardView")) {
      assert.ok(!/-?\d+\.\d+,\s*-?\d+\.\d+/.test(caption), `the card must not leak coordinates: ${caption}`);
      return;
    }
    sent = await h.send(M(), h.textUpdate("👎", viewer));
  }
  throw new Error("never reached PinCardView");
});

// --- go ----------------------------------------------------------------------
(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   - ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL - ${name}\n       ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
