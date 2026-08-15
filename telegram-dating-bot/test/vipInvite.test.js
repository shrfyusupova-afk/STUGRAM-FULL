// VIP invite links: one per buyer, and a request an admin approves for
// everyone who joins free.
//
// The thing being protected is a 21 900 so'm sale. One shared link -- which
// is what this was -- is a link anyone can forward, so a single purchase
// could seat a whole group of friends. A link with member_limit: 1 dies the
// moment it is used, which is the only version of "you bought a seat" that
// actually means one seat.
//
// The other half is the fallback. Every failure path here lands on the shared
// link, because a purchase that delivers NOTHING is worse than one that
// delivers something shareable -- so the failure cases below check that the
// buyer always ends up with a working link, and that /health says loudly when
// that is happening.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Set before the harness loads index.js: vipInvite reads this at require time.
process.env.VIP_CHAT_ID = "-1001234567890";

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of fs.readdirSync(DATA_DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DATA_DIR, f));

const h = require("./harness");
const db = require("../src/db");
const vipInvite = require("../src/vipInvite");
const { VIP_CHAT_INVITE_LINK } = require("../src/vipChat");
const { __test: reporter } = require("../src/chatIdReporter");

const M = () => h.mainBot();

let nextId = 920000;
const user = (name) => {
  nextId += 1;
  return { id: nextId, is_bot: false, first_name: name, username: `${name.toLowerCase()}${nextId}` };
};

async function register(u, { gender = "male", name = "T" } = {}) {
  await h.send(M(), h.commandUpdate("/start", u));
  await h.send(M(), h.callbackUpdate("lang:uz", u));
  await h.send(M(), h.textUpdate(name, u));
  await h.send(M(), h.textUpdate("22", u));
  await h.send(M(), h.callbackUpdate(`gender:${gender}`, u));
  await h.send(M(), h.photoUpdate(u));
  await h.send(M(), h.textUpdate("Toshkent", u));
  await h.send(M(), h.textUpdate("Salom", u));
  await h.send(M(), h.contactUpdate(`+9989${u.id}`, u));
  return h.send(M(), h.textUpdate("✅ Ha", u));
}

const said = (sent) =>
  sent
    .filter((c) => c.method !== "sendChatAction")
    .map((c) => c.payload.text || c.payload.caption || "")
    .join("\n");

// A telegram double that records exactly what was asked of createChatInviteLink.
function fakeTelegram({ fail = false } = {}) {
  const created = [];
  return {
    created,
    getMe: async () => ({ id: 111 }),
    createChatInviteLink: async (chatId, options) => {
      if (fail) throw new Error("Bad Request: not enough rights to manage chat invite link");
      created.push({ chatId, options });
      return { invite_link: `https://t.me/+made${created.length}` };
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- what each kind of link actually asks Telegram for -----------------------

// member_limit: 1 is the whole feature. Without it the link is shareable and
// the purchase seats however many people the buyer forwards it to.
test("a buyer's link admits exactly one person", async () => {
  const telegram = fakeTelegram();
  const link = await vipInvite.vipInviteLink(telegram, 555, { paid: true });

  assert.strictEqual(telegram.created.length, 1, "a link must actually be created");
  const { chatId, options } = telegram.created[0];
  assert.strictEqual(chatId, "-1001234567890", "created in the configured group");
  assert.strictEqual(options.member_limit, 1, "and it must admit exactly one person");
  assert.ok(!options.creates_join_request, "a paid seat is not something to queue for approval");
  assert.match(link, /^https:\/\/t\.me\//);

  // Named after the buyer, so the group's link list says who each seat was
  // for -- the only way to tell afterwards whether one was sold or given.
  assert.match(String(options.name), /555/, "the link should carry the buyer's id");
});

// Free entry, but with a human in the loop: the link raises a request rather
// than admitting anyone who taps it.
test("a free joiner's link raises a request instead of admitting them", async () => {
  vipInvite.__test.resetRequestLink();
  const telegram = fakeTelegram();
  await vipInvite.vipInviteLink(telegram, 777, { paid: false });

  const { options } = telegram.created[0];
  assert.strictEqual(options.creates_join_request, true, "tapping it must ask, not admit");
  assert.ok(!options.member_limit, "Telegram rejects both settings on one link");
});

// Two buyers must never share a link, or the second one is walking through a
// door the first already used.
test("two buyers get two different links", async () => {
  const telegram = fakeTelegram();
  const a = await vipInvite.vipInviteLink(telegram, 111, { paid: true });
  const b = await vipInvite.vipInviteLink(telegram, 222, { paid: true });
  assert.notStrictEqual(a, b, "each purchase is its own seat");
  assert.strictEqual(telegram.created.length, 2);
});

// The request link admits nobody by itself, so a fresh one per tap would just
// pile up hundreds of links in the group's settings for no gain.
test("the request link is made once and reused", async () => {
  vipInvite.__test.resetRequestLink();
  const telegram = fakeTelegram();
  const a = await vipInvite.vipInviteLink(telegram, 1, { paid: false });
  const b = await vipInvite.vipInviteLink(telegram, 2, { paid: false });
  assert.strictEqual(a, b, "the same link serves everyone");
  assert.strictEqual(telegram.created.length, 1, "and is created only once");
});

// --- the fallback ------------------------------------------------------------

// The bot not being an admin of the group is the expected first state of the
// world, and a paying customer must not be the one who discovers it.
test("a buyer still gets a working link when the bot cannot create one", async () => {
  const telegram = fakeTelegram({ fail: true });
  const link = await vipInvite.vipInviteLink(telegram, 999, { paid: true });
  assert.strictEqual(link, VIP_CHAT_INVITE_LINK, "falls back to the shared link, never to nothing");
});

test("so does a free joiner", async () => {
  vipInvite.__test.resetRequestLink();
  const telegram = fakeTelegram({ fail: true });
  const link = await vipInvite.vipInviteLink(telegram, 998, { paid: false });
  assert.strictEqual(link, VIP_CHAT_INVITE_LINK);
});

// --- saying so ---------------------------------------------------------------
//
// Every failure above is silent and correct, which is exactly what makes a
// misconfiguration look like working software. /health is where that shows.

test("the probe says INACTIVE when the bot is not an admin of the group", async () => {
  const status = await vipInvite.probeVipChat({
    getMe: async () => ({ id: 111 }),
    getChatMember: async () => ({ status: "member" }),
  });
  assert.match(status, /^INACTIVE/);
  assert.match(status, /shared link/, "it must say what everyone is getting instead");
});

// Being an admin is not enough -- invite links need one specific right, and
// an admin without it fails in exactly the same way.
test("the probe says INACTIVE for an admin without the invite right", async () => {
  const status = await vipInvite.probeVipChat({
    getMe: async () => ({ id: 111 }),
    getChatMember: async () => ({ status: "administrator", can_invite_users: false }),
  });
  assert.match(status, /^INACTIVE/);
  assert.match(status, /invite users via link/i, "and name the missing right");
});

test("the probe says active when the bot really can create links", async () => {
  const status = await vipInvite.probeVipChat({
    getMe: async () => ({ id: 111 }),
    getChatMember: async () => ({ status: "administrator", can_invite_users: true }),
  });
  assert.match(status, /^active/);
  assert.strictEqual(vipInvite.vipInviteStatus(), status, "/health must see the same answer");
});

// A chat id typed wrong -- a user id pasted by mistake, a group id missing its
// -100 prefix -- would otherwise fail once per purchase, quietly.
test("a malformed VIP_CHAT_ID is refused up front", () => {
  const { normaliseChatId } = vipInvite.__test;
  assert.strictEqual(normaliseChatId("-1001234567890"), "-1001234567890");
  assert.strictEqual(normaliseChatId("@foronevip"), "@foronevip");
  assert.strictEqual(normaliseChatId(" -1001234567890 "), "-1001234567890", "pasted with whitespace");
  assert.strictEqual(normaliseChatId("123456789"), null, "a positive number is somebody's user id");
  assert.strictEqual(normaliseChatId("t.me/joinchat/abc"), null, "an invite link is not a chat id");
  assert.strictEqual(normaliseChatId(""), null);
});

// --- finding the id in the first place ---------------------------------------

test("being added to a group reports its id and whether it can make links", () => {
  const text = reporter.describe({
    chat: { id: -1009876543210, type: "supergroup", title: "ForOne VIP" },
    old_chat_member: { status: "left" },
    new_chat_member: { status: "administrator", can_invite_users: true },
  });
  assert.match(text, /-1009876543210/, "the id is the whole point");
  assert.match(text, /ForOne VIP/, "so the operator knows which group");
  assert.match(text, /VIP_CHAT_ID/, "and what to do with it");
  assert.match(text, /bor ✅/, "and that links will work");
});

test("being added WITHOUT the invite right says what is missing", () => {
  const text = reporter.describe({
    chat: { id: -100111, type: "supergroup", title: "Half" },
    old_chat_member: { status: "left" },
    new_chat_member: { status: "administrator", can_invite_users: false },
  });
  assert.match(text, /yo'q ❌/);
  assert.match(text, /taklif qilish/, "and name the right to switch on");
});

// A private chat's id is the user's own and is already all over the admin
// panel; reporting it would be noise on every single /start.
test("a private chat is not reported", () => {
  assert.strictEqual(
    reporter.describe({
      chat: { id: 12345, type: "private" },
      old_chat_member: { status: "left" },
      new_chat_member: { status: "member" },
    }),
    null
  );
});

// --- through the real bot ----------------------------------------------------

test("a woman tapping join free is told her request needs approval", async () => {
  const her = user("FreeGirl");
  await register(her, { gender: "female", name: "FreeGirl" });

  await h.send(M(), h.textUpdate("👑 VIP suhbat", her));
  const sent = await h.send(M(), h.callbackUpdate("vip:join:free", her));
  const text = said(sent);

  assert.match(text, /t\.me\//, "she still gets a link");
  assert.match(text, /so'rov/, "and is told it sends a request");
  assert.match(text, /tasdiqlagach/, "that an admin has to approve");
});

// The same check that stops a forged callback: gender is re-read server-side.
test("a man tapping the free button is still shown the price", async () => {
  const him = user("SneakyBoy");
  await register(him, { gender: "male", name: "SneakyBoy" });

  const sent = await h.send(M(), h.callbackUpdate("vip:join:free", him));
  const text = said(sent);
  assert.ok(!/t\.me\/\+/.test(text), "no invite link for someone who has not paid");
  assert.match(text, /so'm/, "he is shown the price instead");
});

// Premium currently carries VIP access with it -- a promotion while the group
// is new, because a full room is worth more right now than the seat fee.
test("a Premium member walks into the VIP group without paying again", async () => {
  const rich = user("PremiumGuy");
  await register(rich, { gender: "male", name: "PremiumGuy" });
  await db.setPremiumUntil(rich.id, new Date(Date.now() + 86400000).toISOString());
  assert.strictEqual(await db.hasVipChat(rich.id), false, "he never bought VIP itself");

  const sent = await h.send(M(), h.textUpdate("👑 VIP suhbat", rich));
  const text = said(sent);

  assert.match(text, /t\.me\//, "the link comes straight back");
  assert.ok(!/so'm/.test(text), "and he is not asked to pay");
  assert.match(text, /BEPUL/, "he is told why it is free");
  // The part that matters when it is withdrawn later: a perk that vanishes
  // without ever having been called temporary reads as something taken away.
  assert.match(text, /vaqtinchalik/, "and that the perk is temporary");
});

// Expired Premium is not Premium. Without this the check would read the
// column rather than the date and hand out seats forever.
test("expired Premium does not open the VIP group", async () => {
  const lapsed = user("Lapsed");
  await register(lapsed, { gender: "male", name: "Lapsed" });
  await db.setPremiumUntil(lapsed.id, new Date(Date.now() - 86400000).toISOString());

  const sent = await h.send(M(), h.textUpdate("👑 VIP suhbat", lapsed));
  const text = said(sent);
  assert.ok(!/t\.me\/\+/.test(text), "no link for a lapsed subscription");
  assert.match(text, /so'm/, "he is shown the price");
});

// The pitch has to name it too -- a perk nobody knows they have is not a perk,
// and this is the screen where somebody decides whether Premium is worth it.
test("the Premium pitch names the VIP perk and says it is temporary", async () => {
  const { t } = require("../src/i18n");
  for (const lang of ["uz", "ru", "en"]) {
    const pitch = t(lang, "premiumDetails");
    assert.match(pitch, /VIP/i, `${lang}: the pitch must mention the VIP group`);
    assert.match(
      pitch,
      /vaqtinchalik|временн|temporary/i,
      `${lang}: and must not promise it permanently`
    );
  }
});

test("someone who already paid gets a link back, not a second invoice", async () => {
  const buyer = user("Paid");
  await register(buyer, { gender: "male", name: "Paid" });
  await db.grantVipChat(buyer.id);

  const sent = await h.send(M(), h.textUpdate("👑 VIP suhbat", buyer));
  const text = said(sent);
  assert.match(text, /t\.me\//, "the link comes straight back");
  assert.ok(!/so'm/.test(text), "and they are not asked to pay again");
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
