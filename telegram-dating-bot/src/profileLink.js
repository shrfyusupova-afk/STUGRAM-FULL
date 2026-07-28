// One place that decides how to link to a person's Telegram account, so the
// bot, the admin panel and the complaint cards all behave the same.
//
// The obvious choice -- tg://user?id=<id> -- is NOT reliable, and that is
// what produced "there is no link here": Telegram only turns that href into a
// tappable link when the client can resolve the user id. In the admin bot,
// which those people have never talked to, it usually cannot, so the anchor
// is dropped and the text renders as ordinary grey text with nothing behind
// it. Worse, it fails silently and only for SOME people, so one row in a list
// is a link and the next one isn't.
//
// An https:// link is always rendered, whatever the client knows, so both
// preferred options below are real links every time:
//
//   1. https://t.me/<username> -- exact, when a @username has been captured.
//   2. https://t.me/+<phone>   -- t.me resolves a phone number to its
//      Telegram account. The anketa's phone is not free text: it comes from a
//      shared contact card that was checked to belong to the sender, so it is
//      the account's real, verified number.
//
// tg://user stays as a last resort for the rare record that has neither.

// Nine digits is the shortest national number worth trying; anything less is
// a typo or a placeholder, not something t.me can resolve.
const MIN_PHONE_DIGITS = 9;

function phoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function profileLinkHref(id, profile) {
  if (profile?.username) return `https://t.me/${encodeURIComponent(profile.username)}`;
  const digits = phoneDigits(profile?.phone);
  if (digits.length >= MIN_PHONE_DIGITS) return `https://t.me/+${digits}`;
  return `tg://user?id=${encodeURIComponent(id)}`;
}

// Which of the three it ended up being -- callers word their labels
// differently, and one of them ("weak") is worth flagging to an admin.
function profileLinkKind(profile) {
  if (profile?.username) return "username";
  if (phoneDigits(profile?.phone).length >= MIN_PHONE_DIGITS) return "phone";
  return "weak";
}

module.exports = { profileLinkHref, profileLinkKind };
