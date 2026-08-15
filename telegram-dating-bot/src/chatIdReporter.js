// "Where do I get the group's chat id?"
//
// It is not shown anywhere in the Telegram apps, and every usual answer is a
// detour: forward a message to some third-party id bot, or open the web
// client and read it out of the URL. Both mean trusting or fiddling with
// something outside this project to configure something inside it.
//
// The bot is being added to that group anyway -- it has to be an admin there
// to make invite links at all -- and Telegram tells it so, with the id
// attached. So the moment it is added, it says what the id is, in the alert
// channel the operator already watches.
const { alert } = require("./alerts");

// Only groups. A private chat's id is just the user's own id and is already
// visible everywhere in the admin panel.
const GROUP_TYPES = new Set(["group", "supergroup", "channel"]);
const PRESENT = new Set(["member", "administrator", "creator", "restricted"]);

function describe(update) {
  const chat = update?.chat;
  if (!chat || !GROUP_TYPES.has(chat.type)) return null;

  const status = update.new_chat_member?.status;
  const wasPresent = PRESENT.has(update.old_chat_member?.status);
  const isPresent = PRESENT.has(status);

  // Only the transitions worth a message: being added, being promoted (the
  // step that actually unlocks invite links), and being removed.
  if (!isPresent && !wasPresent) return null;

  // Plain text, no HTML: alert() sends without a parse_mode, so tags would
  // arrive as literal angle brackets.
  const title = chat.title || "(nomsiz)";

  if (!isPresent) {
    return `Bot "${title}" guruhidan chiqarildi.\nChat ID: ${chat.id}`;
  }

  const admin = status === "administrator" || status === "creator";
  const canInvite = admin ? update.new_chat_member?.can_invite_users !== false : false;

  return (
    `Bot "${title}" guruhiga qo'shildi.\n\n` +
    `Chat ID: ${chat.id}\n` +
    `Holati: ${admin ? "administrator" : status}\n` +
    `Havola yaratish huquqi: ${canInvite ? "bor ✅" : "yo'q ❌"}\n\n` +
    (admin && canInvite
      ? `Shu ID ni Render'da VIP_CHAT_ID ga qo'ying — shundan so'ng ` +
        `har bir to'lovchi bir martalik havola oladi.`
      : `Bir martalik havolalar uchun botni administrator qiling va ` +
        `"Foydalanuvchilarni havola orqali taklif qilish" huquqini bering.`)
  );
}

// Registered on the MAIN bot, which is the one that gets added to the VIP
// group. Failure to report is never allowed to matter: this is a convenience
// for the operator, not part of anybody's experience of the product.
function registerChatIdReporter(bot) {
  bot.on("my_chat_member", async (ctx, next) => {
    try {
      const text = describe(ctx.myChatMember);
      if (text) {
        console.log(`Chat membership change: ${ctx.myChatMember.chat.id} (${ctx.myChatMember.chat.title || ""})`);
        // bypassThrottle: this fires at most a few times ever, and it is the
        // one message the operator is waiting for while configuring.
        await alert(text, { bypassThrottle: true });
      }
    } catch (err) {
      console.error("chat id reporter failed (ignored):", err.message);
    }
    // Never the last word on this update -- something else may want it.
    if (next) return next();
  });
}

module.exports = { registerChatIdReporter, __test: { describe } };
