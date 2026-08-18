const { Scenes, Markup } = require("telegraf");
const { getProfile, saveProfile, setTelegramUsername, getLanguage } = require("../db");
const { rewardIfEarned, notifyReferrer } = require("../referral");
const { sendMainMenu, mainMenuKeyboard } = require("../menu");
const { t, DEFAULT_LANG } = require("../i18n");
const { getUsername, getPublicUrl } = require("../botInfo");
const { isRegistered } = require("../profileState");
const { resolveLocation } = require("../geo");
const { isSubscribed, isEnabled, CHANNEL_URL } = require("../channelGate");

const MIN_AGE = 10;
const MAX_AGE = 90;
const MAX_BIO_LENGTH = 80;

const STEP_ORDER = ["name", "age", "gender", "media", "location", "bio", "contact", "confirm"];

function backKeyboard(lang, extraButtons = []) {
  return Markup.keyboard([...extraButtons.map((b) => [b]), [t(lang, "backButton")]]).resize();
}

function isBackText(ctx, lang) {
  return ctx.message?.text?.trim() === t(lang, "backButton");
}

// A slash command is never the answer to "what is your name?". The stage
// middleware runs before bot.start, so while the form is open EVERY update
// belongs to the current step -- and "/start" was being stored as somebody's
// name (verified: the saved profile really did come out named "/start").
// Worse, that left no way out at all: someone who opened the form and
// changed their mind had every later tap read as input to whatever step
// they were stuck on.
function commandName(ctx) {
  const msg = ctx.message;
  if (typeof msg?.text !== "string") return null;
  const entity = msg.entities?.find((e) => e.type === "bot_command" && e.offset === 0);
  if (!entity) return null;
  // "/anketa@SomeBot" in a group -- the bot name is not part of the command.
  return msg.text.slice(1, entity.length).split("@")[0].toLowerCase();
}

// The commands that mean "take me back to the beginning of the form". Both
// already do exactly that outside the wizard, so honouring them inside it is
// the behaviour a person expects, not a special case they have to learn.
const RESTART_COMMANDS = new Set(["start", "anketa"]);

// One render function per step -- called both when moving forward AND when
// going back, so each step always sets its OWN correct keyboard rather than
// relying on whatever the previous step left behind.
const RENDERERS = {
  // Fresh signups have no menu to go "back" to, so this stays keyboard-less.
  // Editing an existing profile enters here too, though -- in that case a
  // back button (returning to the main menu, handled in the dispatcher
  // below) is shown, since there IS somewhere to go back to.
  name: async (ctx, lang) => {
    const keyboard = ctx.wizard.state.isEditing ? backKeyboard(lang) : Markup.removeKeyboard();
    await ctx.reply(t(lang, "askName"), keyboard);
  },
  age: async (ctx, lang) => {
    await ctx.reply(t(lang, "askAge"), backKeyboard(lang));
  },
  gender: async (ctx, lang) => {
    await ctx.reply(
      t(lang, "askGender"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t(lang, "genderMale"), "gender:male"),
          Markup.button.callback(t(lang, "genderFemale"), "gender:female"),
        ],
      ])
    );
  },
  media: async (ctx, lang) => {
    await ctx.reply(t(lang, "askMedia"), backKeyboard(lang));
  },
  location: async (ctx, lang) => {
    // Telegram refuses a location-request button OUTSIDE a private chat --
    // "location can be requested in private chats only" -- and refuses the
    // WHOLE sendMessage call over it, not just the button. That crashed this
    // step for anyone the wizard ever runs against in a group (the bot is a
    // member of the VIP group, and a session is per chat+user, so typing
    // /anketa there starts a fresh registration IN the group). Typing the
    // location in is still offered either way, so nobody loses the ability
    // to finish -- they just don't get the one-tap button outside a DM.
    const extraButtons = ctx.chat?.type === "private" ? [Markup.button.locationRequest(t(lang, "locationButton"))] : [];
    await ctx.reply(t(lang, "askLocation"), {
      parse_mode: "HTML",
      ...backKeyboard(lang, extraButtons),
    });
  },
  bio: async (ctx, lang) => {
    await ctx.reply(t(lang, "askBio"), backKeyboard(lang));
  },
  contact: async (ctx, lang) => {
    await ctx.reply(
      t(lang, "askContact"),
      backKeyboard(lang, [Markup.button.contactRequest(t(lang, "contactButton"))])
    );
  },
  // Prefers a real standalone page (GET /policy, served by this bot's own
  // Express app) so tapping the link opens an actual separate browser
  // window/tab -- falls back to a deep link back into this chat
  // (/start policy) only when there's no public HTTPS domain to link to
  // (e.g. local long-polling).
  confirm: async (ctx, lang) => {
    const publicUrl = getPublicUrl();
    const username = getUsername();
    const policyUrl = publicUrl ? `${publicUrl}/policy` : username ? `https://t.me/${username}?start=policy` : null;
    const linkLabel = t(lang, "policyLinkText");
    const linkHtml = policyUrl ? `<a href="${policyUrl}">${linkLabel}</a>` : linkLabel;
    await ctx.reply(t(lang, "confirmIntro")(linkHtml), {
      parse_mode: "HTML",
      ...backKeyboard(lang, [t(lang, "confirmYesButton")]),
    });
  },
};

async function renderStep(ctx, stepKey) {
  await RENDERERS[stepKey](ctx, ctx.wizard.state.lang);
}

// Each handler validates + stores the reply belonging to its own step.
// Returns true to advance to the next step, false to stay (an error message
// has already been sent to the user).
const HANDLERS = {
  name: async (ctx, lang, profile) => {
    const text = ctx.message?.text?.trim();
    if (!text || text.length < 2 || text.length > 50) {
      await ctx.reply(t(lang, "errName"));
      return false;
    }
    profile.name = text;
    return true;
  },
  age: async (ctx, lang, profile) => {
    const age = Number(ctx.message?.text?.trim());
    if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
      await ctx.reply(t(lang, "errAge")(MIN_AGE, MAX_AGE));
      return false;
    }
    profile.age = age;
    return true;
  },
  gender: async (ctx, lang, profile) => {
    const data = ctx.callbackQuery?.data;
    if (data !== "gender:male" && data !== "gender:female") {
      await ctx.reply(t(lang, "errGenderButtons"));
      return false;
    }
    await ctx.answerCbQuery();
    profile.gender = data === "gender:male" ? "male" : "female";
    return true;
  },
  media: async (ctx, lang, profile) => {
    const photos = ctx.message?.photo;
    if (photos && photos.length) {
      profile.mediaFileId = photos[photos.length - 1].file_id;
      profile.mediaType = "photo";
      return true;
    }
    const video = ctx.message?.video;
    if (video) {
      profile.mediaFileId = video.file_id;
      profile.mediaType = "video";
      return true;
    }
    await ctx.reply(t(lang, "errMedia"));
    return false;
  },
  // A location is only worth storing if it can be placed on a map -- that is
  // what lets every profile card show "how far is this from me?". Free text
  // used to be accepted as-is, so a handful of mashed letters became somebody's
  // permanent location and nothing downstream could do anything with it.
  // resolveLocation both rejects that and canonicalises spelling, so
  // "chilanzar", "Чилонзор" and "Chilonzor tumani" all end up stored
  // identically.
  location: async (ctx, lang, profile) => {
    const loc = ctx.message?.location;
    if (loc) {
      profile.location = `${loc.latitude}, ${loc.longitude}`;
      return true;
    }
    const text = ctx.message?.text?.trim();
    if (!text || text.length < 2 || text.length > 100) {
      await ctx.reply(t(lang, "errLocation"));
      return false;
    }
    const resolved = resolveLocation(text);
    if (!resolved) {
      await ctx.reply(t(lang, "errLocationUnknown"), { parse_mode: "HTML" });
      return false;
    }
    profile.location = resolved.label;
    return true;
  },
  bio: async (ctx, lang, profile) => {
    const text = ctx.message?.text?.trim();
    if (!text || text.length > MAX_BIO_LENGTH) {
      await ctx.reply(t(lang, "errBio"));
      return false;
    }
    profile.bio = text;
    return true;
  },
  // Phone confirmation doubles as a lightweight anti-fake-profile check: a
  // shared contact card is tied to a real Telegram account, unlike free text.
  contact: async (ctx, lang, profile) => {
    const contact = ctx.message?.contact;
    if (!contact?.phone_number) {
      await ctx.reply(t(lang, "errContact"));
      return false;
    }
    if (contact.user_id && contact.user_id !== ctx.from.id) {
      await ctx.reply(t(lang, "errContactOwn"));
      return false;
    }
    profile.phone = contact.phone_number;
    return true;
  },
  confirm: async (ctx, lang) => {
    const text = ctx.message?.text?.trim();
    if (text !== t(lang, "confirmYesButton")) {
      await ctx.reply(t(lang, "confirmError"));
      return false;
    }
    return true;
  },
};

async function finish(ctx, lang, profile) {
  const wasAlreadyRegistered = Boolean(ctx.wizard.state.isEditing);
  profile.genderLabel = profile.gender === "male" ? t(lang, "genderMaleValue") : t(lang, "genderFemaleValue");
  const saved = await saveProfile(ctx.from.id, profile);

  // Captured here, at the one moment a record is guaranteed to exist. The
  // per-message capture in index.js only UPDATES (it must never invent a
  // record for someone with no anketa), and it remembers the handle it last
  // saw -- so without this, someone who registers would never get their
  // @username stored at all, and their profile link would fall back to the
  // phone number for no reason.
  try {
    await setTelegramUsername(ctx.from.id, ctx.from.username || null);
  } catch (err) {
    console.error("username capture at registration failed (ignored):", err.message);
  }

  // A brand-new anketa gets a welcome and a pitch for what else is here --
  // that is the moment to sell the rest of the bot. Editing an existing one
  // gets the old confirmation instead, so they can actually check what was
  // just saved rather than hear the same pitch again.
  const confirmationText = wasAlreadyRegistered ? t(lang, "profileSaved")(saved) : t(lang, "welcomeAfterRegistration")(saved);
  await ctx.reply(confirmationText, mainMenuKeyboard(lang));

  // A soft invitation, not a gate: a brand-new user has just finished a long
  // form, and blocking them here would be the worst possible first moment to
  // ask for anything. Skipped entirely for somebody already subscribed, and
  // for an edit (they have seen it before).
  if (!wasAlreadyRegistered && isEnabled() && !(await isSubscribed(ctx.telegram, ctx.from.id))) {
    try {
      await ctx.reply(t(lang, "channelWelcomeInvite"), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([[Markup.button.url(t(lang, "channelJoinButton"), CHANNEL_URL)]]),
      });
    } catch (err) {
      console.error("channel invite after registration failed (ignored):", err.message);
    }
  }

  // The one moment an invitation is worth anything: this person now has a
  // complete anketa, phone number included. Paying on the /start click
  // instead would make a referral credit cost nothing but a throwaway
  // account.
  //
  // finish() also runs when an EXISTING user edits their profile, so this
  // must not pay twice -- rewardIfEarned claims the invitee with a single
  // conditional update and returns null for every later call.
  //
  // Wrapped: the referrer's bonus is not worth failing this person's
  // registration over. Their anketa is already saved by the line above.
  try {
    const outcome = await rewardIfEarned(ctx.from.id);
    if (outcome) await notifyReferrer(ctx.telegram, outcome, getLanguage);
  } catch (err) {
    console.error("referral reward failed (ignored):", err.message);
  }
}

const profileWizard = new Scenes.WizardScene(
  "profile-wizard",
  async (ctx) => {
    // Editing seeds the draft from the existing record so fields the wizard
    // never touches (active, premiumUntil) survive the save -- a fresh
    // signup has no prior record, so it really does start blank.
    const existing = ctx.wizard.state.isEditing ? await getProfile(ctx.from.id) : null;
    ctx.wizard.state.profile = existing ? { ...existing } : {};
    ctx.wizard.state.lang = ctx.wizard.state.lang || DEFAULT_LANG;
    ctx.wizard.state.stepIndex = 0;
    await renderStep(ctx, STEP_ORDER[0]);
    return ctx.wizard.next();
  },
  async (ctx) => {
    // While this form is open, the stage middleware routes EVERY update here
    // -- including ones that are not a person answering anything. Blocking
    // the bot sends a my_chat_member update, and that used to fall straight
    // through to the current step's handler, which found no photo/text,
    // and tried to reply "please send a photo" to someone who had just
    // blocked us. That reply fails with 403 and the failure surfaced as a
    // crash alert. Same shape as the /start-stored-as-a-name bug above:
    // an update that is not an answer must not be read as one.
    if (!ctx.message && !ctx.callbackQuery) return;

    const lang = ctx.wizard.state.lang;
    const idx = ctx.wizard.state.stepIndex;
    const stepKey = STEP_ORDER[idx];

    const command = commandName(ctx);
    if (command) {
      if (RESTART_COMMANDS.has(command)) {
        ctx.wizard.state.profile = ctx.wizard.state.isEditing ? { ...(await getProfile(ctx.from.id)) } : {};
        ctx.wizard.state.stepIndex = 0;
        await renderStep(ctx, STEP_ORDER[0]);
        return;
      }
      await ctx.reply(t(lang, "errCommandInForm"));
      return;
    }

    if (isBackText(ctx, lang)) {
      if (idx === 0) {
        if (ctx.wizard.state.isEditing) {
          const existing = await getProfile(ctx.from.id);
          if (isRegistered(existing)) {
            await sendMainMenu(ctx, lang);
          }
          return ctx.scene.leave();
        }
        await ctx.reply(t(lang, "errFirstStep"));
        return;
      }
      ctx.wizard.state.stepIndex = idx - 1;
      await renderStep(ctx, STEP_ORDER[idx - 1]);
      return;
    }

    const ok = await HANDLERS[stepKey](ctx, lang, ctx.wizard.state.profile);
    if (!ok) return;

    const nextIdx = idx + 1;
    if (nextIdx >= STEP_ORDER.length) {
      await finish(ctx, lang, ctx.wizard.state.profile);
      return ctx.scene.leave();
    }
    ctx.wizard.state.stepIndex = nextIdx;
    await renderStep(ctx, STEP_ORDER[nextIdx]);
  }
);

module.exports = { profileWizard };
