// "A record exists" and "this person has an anketa" are NOT the same thing,
// and treating them as the same is what produced "Xush kelibsiz, undefined":
// a record can exist carrying only a paid entitlement (someone bought Premium
// before finishing -- or after deleting -- their anketa), and older builds
// also created one for anyone who merely used the bot.
//
// The wizard writes every field at once, so a name is present exactly when a
// real anketa was completed. Everywhere that asks "do they have an anketa?"
// goes through this, so the answer cannot drift between screens.
function isRegistered(profile) {
  return !!profile?.name;
}

module.exports = { isRegistered };
