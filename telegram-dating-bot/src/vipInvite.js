// Invite links for the VIP group, made by the bot rather than pasted in.
//
// The two ways in are deliberately different, because the two people are:
//
//   * Somebody who PAID gets a link with member_limit: 1. It admits exactly
//     one person and then dies. A single shared link -- which is what this
//     used to be -- is a link anyone can forward, so one person's 21 900
//     so'm could seat a whole group of their friends for free.
//
//   * Somebody who is free to join (women) gets a link with
//     creates_join_request: true. Tapping it does not admit them; it puts a
//     request in front of the group's admins, who decide. That is the point:
//     free entry with a human in the loop, rather than free entry with none.
//
// Telegram will not accept both settings on one link -- member_limit and
// creates_join_request are mutually exclusive -- which is fine, since they
// are answering different questions.
//
// Everything here needs the bot to be an ADMIN of the group with the "invite
// users via link" right. Without that, every call fails, and every path falls
// back to the static link so the feature degrades to exactly what it was
// before instead of leaving a paying customer with nothing.
const { VIP_CHAT_INVITE_LINK } = require("./vipChat");

// Accepts a numeric id ("-1001234567890") or a public @username. A supergroup
// id is negative and starts with -100; a bare positive number is almost
// certainly somebody's user id pasted by mistake, so it is refused rather
// than sent to Telegram to fail confusingly later.
function normaliseChatId(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^@[A-Za-z0-9_]{4,}$/.test(trimmed)) return trimmed;
  if (/^-\d{6,}$/.test(trimmed)) return trimmed;
  return null;
}

const VIP_CHAT_ID = normaliseChatId(process.env.VIP_CHAT_ID);

function configProblem() {
  const raw = process.env.VIP_CHAT_ID;
  if (!raw) return null; // not configured at all is not a mistake, just off
  if (VIP_CHAT_ID) return null;
  return (
    `VIP_CHAT_ID is set to "${raw}", which is neither a supergroup id ` +
    `(starts with -100) nor an @username. One-time invite links are disabled.`
  );
}

function isEnabled() {
  return Boolean(VIP_CHAT_ID);
}

// --- the join-request link ---------------------------------------------------
//
// Reused rather than made per person: it admits nobody by itself, so there is
// nothing to gain from a fresh one each time, and a new link per tap would
// pile up hundreds of them in the group's settings.
let requestLink = null;

async function joinRequestLink(telegram) {
  if (!VIP_CHAT_ID) return VIP_CHAT_INVITE_LINK;
  if (requestLink) return requestLink;
  try {
    const created = await telegram.createChatInviteLink(VIP_CHAT_ID, {
      name: "ForOne — qizlar (so'rov)",
      creates_join_request: true,
    });
    requestLink = created.invite_link;
    return requestLink;
  } catch (err) {
    console.error("VIP join-request link failed (using the static link):", err.message);
    return VIP_CHAT_INVITE_LINK;
  }
}

// --- the paid, single-use link -----------------------------------------------

// Named after the buyer so the group's invite-link list says who each one was
// for -- which is the only way to tell, after the fact, whether a seat was
// sold or given away.
async function singleUseLink(telegram, userId) {
  if (!VIP_CHAT_ID) return VIP_CHAT_INVITE_LINK;
  try {
    const created = await telegram.createChatInviteLink(VIP_CHAT_ID, {
      name: `ForOne — to'lov ${userId}`.slice(0, 32),
      member_limit: 1,
    });
    return created.invite_link;
  } catch (err) {
    // A paying customer must never be left with nothing because a link could
    // not be minted. The static link still works; it is simply shareable,
    // which is a smaller problem than a purchase that delivered nothing.
    console.error(`VIP single-use link failed for ${userId} (using the static link):`, err.message);
    return VIP_CHAT_INVITE_LINK;
  }
}

// The one call sites make. `paid` decides which of the two kinds they get.
async function vipInviteLink(telegram, userId, { paid }) {
  return paid ? singleUseLink(telegram, userId) : joinRequestLink(telegram);
}

// --- is any of this actually working? ----------------------------------------
//
// Same reasoning as the channel gate: every failure path here falls back
// silently and correctly, which means a misconfiguration looks exactly like
// working software. Probed once at startup and reported on /health.
let status = "unknown (not probed yet)";

async function probeVipChat(telegram) {
  const problem = configProblem();
  if (problem) {
    status = `MISCONFIGURED -- ${problem}`;
    console.warn(`VIP invites: ${status}`);
    return status;
  }
  if (!VIP_CHAT_ID) {
    status = "disabled (no VIP_CHAT_ID -- one shared link for everyone)";
    console.log(`VIP invites: ${status}`);
    return status;
  }
  try {
    const me = await telegram.getMe();
    const member = await telegram.getChatMember(VIP_CHAT_ID, me.id);
    if (member?.status !== "administrator" && member?.status !== "creator") {
      status =
        `INACTIVE -- the bot is "${member?.status}" in the VIP chat, not an admin, ` +
        `so it cannot create invite links. Everyone gets the shared link instead. ` +
        `Fix: make the bot an administrator with the "invite users via link" right.`;
    } else if (member.status === "administrator" && member.can_invite_users === false) {
      status =
        `INACTIVE -- the bot is an admin of the VIP chat but WITHOUT the ` +
        `"invite users via link" right, so it cannot create invite links. ` +
        `Everyone gets the shared link instead.`;
    } else {
      status = `active (${VIP_CHAT_ID})`;
    }
  } catch (err) {
    status =
      `INACTIVE -- cannot read the VIP chat ${VIP_CHAT_ID} (${err.message}). ` +
      `Everyone gets the shared link instead. ` +
      `Fix: add the bot to that group as an administrator.`;
  }

  if (status.startsWith("active")) console.log(`VIP invites: ${status}`);
  else console.warn(`VIP invites: ${status}`);
  return status;
}

function vipInviteStatus() {
  return status;
}

module.exports = {
  vipInviteLink,
  probeVipChat,
  vipInviteStatus,
  isEnabled,
  VIP_CHAT_ID,
  __test: { normaliseChatId, configProblem, resetRequestLink: () => (requestLink = null) },
};
