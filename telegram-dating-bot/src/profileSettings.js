const { Markup } = require("telegraf");
const {
  getProfile,
  setProfileActive,
  getLanguage,
  getNotificationsEnabled,
  setNotificationsEnabled,
} = require("./db");
const { t, DEFAULT_LANG, STRINGS } = require("./i18n");
const { sendCandidate } = require("./discover");
const { isRegistered } = require("./profileState");

// Returning to the main menu from this submenu is handled by discover.js's
// existing global "Back" handler (same label, same action) -- registering a
// second one here would just be dead code, since the first-registered
// bot.hears for a given trigger is the one Telegraf runs.
function settingsKeyboard(lang, isActive, notificationsOn) {
  const toggleLabel = isActive ? t(lang, "profileSettingsDeactivate") : t(lang, "profileSettingsActivate");
  // The win-back message tells people they can turn these back on here, so
  // the button has to actually exist -- otherwise that message is a lie and
  // the only remaining way out is blocking the bot.
  const notifyLabel = notificationsOn
    ? t(lang, "notificationsDisableButton")
    : t(lang, "notificationsEnableButton");
  return Markup.keyboard([
    [t(lang, "profileSettingsEdit"), t(lang, "profileSettingsView")],
    [toggleLabel],
    [notifyLabel],
    [t(lang, "backButton")],
  ]).resize();
}

function registerProfileSettingsHandlers(bot) {
  const settingsLabels = Object.values(STRINGS).map((dict) => dict.menu.profile);
  const editLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsEdit);
  const viewLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsView);
  const deactivateLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsDeactivate);
  const activateLabels = Object.values(STRINGS).map((dict) => dict.profileSettingsActivate);
  const notifyOnLabels = Object.values(STRINGS).map((dict) => dict.notificationsEnableButton);
  const notifyOffLabels = Object.values(STRINGS).map((dict) => dict.notificationsDisableButton);

  bot.hears(settingsLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    if (!isRegistered(me)) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await ctx.reply(
      t(lang, "profileSettingsIntro"),
      settingsKeyboard(lang, me.active !== false, await getNotificationsEnabled(ctx.from.id))
    );
  });

  async function setNotifications(ctx, enabled) {
    const lang = (await getLanguage(ctx.from.id)) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    if (!isRegistered(me)) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await setNotificationsEnabled(ctx.from.id, enabled);
    await ctx.reply(
      t(lang, enabled ? "notificationsEnabledNotice" : "notificationsDisabledNotice"),
      settingsKeyboard(lang, me.active !== false, enabled)
    );
  }

  bot.hears(notifyOnLabels, (ctx) => setNotifications(ctx, true));
  bot.hears(notifyOffLabels, (ctx) => setNotifications(ctx, false));

  bot.hears(editLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    await ctx.scene.enter("profile-wizard", { lang, isEditing: true });
  });

  bot.hears(viewLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const me = await getProfile(ctx.from.id);
    if (!isRegistered(me)) {
      await ctx.reply(t(lang, "noProfileYet"));
      return;
    }
    await sendCandidate(ctx, lang, ctx.from.id, me, undefined, { includeUnlock: false });
    const isPremiumNow = !!me.premiumUntil && new Date(me.premiumUntil) > new Date();
    const premiumLine = isPremiumNow
      ? t(lang, "profilePremiumActive")(new Date(me.premiumUntil).toISOString().slice(0, 10))
      : t(lang, "profilePremiumNone");
    await ctx.reply(
      `${me.active === false ? t(lang, "profileStatusInactive") : t(lang, "profileStatusActive")}\n${premiumLine}`
    );
  });

  bot.hears(deactivateLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const updated = await setProfileActive(ctx.from.id, false);
    if (!updated) return;
    await ctx.reply(t(lang, "profileDeactivated"), settingsKeyboard(lang, false));
  });

  bot.hears(activateLabels, async (ctx) => {
    const lang = await getLanguage(ctx.from.id) || DEFAULT_LANG;
    const updated = await setProfileActive(ctx.from.id, true);
    if (!updated) return;
    await ctx.reply(t(lang, "profileActivated"), settingsKeyboard(lang, true));
  });
}

module.exports = { registerProfileSettingsHandlers };
