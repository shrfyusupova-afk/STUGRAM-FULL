const { Scenes, Markup } = require("telegraf");
const { getProfile, saveProfile } = require("../db");
const { sendMainMenu } = require("../menu");
const { t, DEFAULT_LANG } = require("../i18n");

const MIN_AGE = 18;
const MAX_AGE = 90;

const STEP_ORDER = ["name", "age", "gender", "media", "location", "bio", "contact"];

function backKeyboard(lang, extraButtons = []) {
  return Markup.keyboard([...extraButtons.map((b) => [b]), [t(lang, "backButton")]]).resize();
}

function isBackText(ctx, lang) {
  return ctx.message?.text?.trim() === t(lang, "backButton");
}

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
    await ctx.reply(
      t(lang, "askLocation"),
      backKeyboard(lang, [Markup.button.locationRequest(t(lang, "locationButton"))])
    );
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
    profile.location = text;
    return true;
  },
  bio: async (ctx, lang, profile) => {
    const text = ctx.message?.text?.trim();
    if (!text || text.length > 500) {
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
};

async function finish(ctx, lang, profile) {
  profile.genderLabel = profile.gender === "male" ? t(lang, "genderMaleValue") : t(lang, "genderFemaleValue");
  const saved = saveProfile(ctx.from.id, profile);
  await sendMainMenu(ctx, saved, lang);
}

const profileWizard = new Scenes.WizardScene(
  "profile-wizard",
  async (ctx) => {
    ctx.wizard.state.profile = {};
    ctx.wizard.state.lang = ctx.wizard.state.lang || DEFAULT_LANG;
    ctx.wizard.state.stepIndex = 0;
    await renderStep(ctx, STEP_ORDER[0]);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const lang = ctx.wizard.state.lang;
    const idx = ctx.wizard.state.stepIndex;
    const stepKey = STEP_ORDER[idx];

    if (isBackText(ctx, lang)) {
      if (idx === 0) {
        if (ctx.wizard.state.isEditing) {
          const existing = getProfile(ctx.from.id);
          if (existing) {
            await sendMainMenu(ctx, existing, lang);
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
