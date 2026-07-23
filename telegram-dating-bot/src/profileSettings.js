const { Markup } = require("telegraf");
const { getProfile, setProfileActive, getLanguage } = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { sendCandidate } = require("./discover");

// Returning to the main menu from this submenu is handled by discover.js's
// existing global "Back" handler (same label, same action) -- registering a
// second one here would just be dead code, since the first-registered
// bot.hears for a given trigger is the one Telegraf runs.
function settingsKeyboard(lang, isActive) {
  const toggleLabel = isActive ? t(lang, "profileSettingsDeactivate") : t(lang, "profileSettingsActivate");
  return Markup.keyboard([
    [t(lang, "profileSettingsEdit"), t(lang, "profileSettingsView")],
    [toggleLabel],
    [t(lang, "backButton")],
  ]).resize();
}

function registerProfileSettingsHandlers(bot) {
  const settingsLabels = Object.values(STRINGS).map((dict) => dict.menu.profile);
  const editLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsEdit);
  const viewLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsView);
  const deactivateLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsDeactivate);
  const activateLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsActivate);

  bot.hears(settingsLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    if (!me) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await ctx.reply(t(lang, "profileSettingsIntro"), settingsKeyboard(lang, me.active !== false));
  });

  bot.hears(editLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.scene.enter("profile-wizard", { lang });
  });

  bot.hears(viewLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = getProfile(ctx.from.id);
    if (!me) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await sendCandidate(ctx, lang, ctx.from.id, me, undefined, { includeUnlock: false });
    await ctx.reply(me.active === false ? t(lang, "profileStatusInactive") : t(lang, "profileStatusActive"));
  });

  bot.hears(deactivateLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const updated = setProfileActive(ctx.from.id, false);
    if (!updated) return;
    await ctx.reply(t(lang, "profileDeactivated"), settingsKeyboard(lang, false));
  });

  bot.hears(activateLabels, async (ctx) => {
    const lang = getLanguage(ctx.from.id) || DEFAULT_LANG;
    const updated = setProfileActive(ctx.from.id, true);
    if (!updated) return;
    await ctx.reply(t(lang, "profileActivated"), settingsKeyboard(lang, true));
  });
}

module.exports = { registerProfileSettingsHandlers };
