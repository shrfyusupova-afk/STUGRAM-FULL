// Places, typo-tolerant matching, and the distance between two of them.
//
// Two problems this solves. First, "location" used to be any text at all --
// somebody mashing "asdfgh" got a profile whose location line was noise, and
// nothing downstream could do anything with it. Second, a location is far
// more useful to the person swiping when it answers "how far is that from
// ME?" than when it just names a place they may not know.
//
// Everything here is offline: a fixed catalogue with coordinates, matched by
// normalising the text and allowing a couple of typos. No geocoding API, no
// network call on a hot path, no key to configure.

// --- catalogue ---------------------------------------------------------------
//
// Tashkent's districts come first because that is where the "4 km" case
// actually matters -- two people in the same city want the distance between
// their districts, not "Toshkent" twice. Regional centres and the larger
// cities follow so the rest of the country resolves too.
//
// aliases: every spelling a real person might type -- Latin and Cyrillic, the
// Soviet-era Russian forms people still use, and the common apostrophe-less
// variants. Matching is done on the NORMALISED form (see normalize), so these
// only need to differ in letters, not in case or punctuation.
const PLACES = [
  // --- Toshkent shahri, tumanlar ---
  { label: "Bektemir", lat: 41.2167, lon: 69.3333, city: "Toshkent", aliases: ["bektemir", "бектемир"] },
  { label: "Chilonzor", lat: 41.2750, lon: 69.2044, city: "Toshkent", aliases: ["chilonzor", "chilanzar", "chilonzar", "chilanzor", "чилонзор", "чиланзар"] },
  { label: "Mirobod", lat: 41.2950, lon: 69.2900, city: "Toshkent", aliases: ["mirobod", "mirabad", "миробод", "мирабад"] },
  { label: "Mirzo Ulug'bek", lat: 41.3250, lon: 69.3350, city: "Toshkent", aliases: ["mirzo ulugbek", "ulugbek", "mirzoulugbek", "мирзо улугбек", "улугбек"] },
  { label: "Olmazor", lat: 41.3400, lon: 69.2050, city: "Toshkent", aliases: ["olmazor", "almazar", "олмазор", "алмазар"] },
  { label: "Sergeli", lat: 41.2200, lon: 69.2200, city: "Toshkent", aliases: ["sergeli", "sergely", "сергели"] },
  { label: "Shayxontohur", lat: 41.3200, lon: 69.2200, city: "Toshkent", aliases: ["shayxontohur", "shaykhantahur", "shayxontoxur", "sheyxontohur", "шайхонтохур", "шайхантахур"] },
  { label: "Uchtepa", lat: 41.2870, lon: 69.1780, city: "Toshkent", aliases: ["uchtepa", "uchtepa", "учтепа"] },
  { label: "Yakkasaroy", lat: 41.2830, lon: 69.2450, city: "Toshkent", aliases: ["yakkasaroy", "yakkasaray", "яккасарой", "яккасарай"] },
  { label: "Yashnobod", lat: 41.2900, lon: 69.3350, city: "Toshkent", aliases: ["yashnobod", "yashnabad", "hamza", "яшнобод", "яшнабад"] },
  { label: "Yunusobod", lat: 41.3670, lon: 69.2890, city: "Toshkent", aliases: ["yunusobod", "yunusabad", "yunusobad", "юнусобод", "юнусабад"] },
  { label: "Yangihayot", lat: 41.1950, lon: 69.2500, city: "Toshkent", aliases: ["yangihayot", "yangi hayot", "янгихаёт", "янги хаёт"] },

  // --- Toshkent shahri (tumani aytilmagan) ---
  { label: "Toshkent", lat: 41.2995, lon: 69.2401, city: "Toshkent", aliases: ["toshkent", "tashkent", "toshkent shahri", "ташкент", "тошкент"] },

  // --- Viloyat markazlari ---
  { label: "Nukus", lat: 42.4600, lon: 59.6100, city: "Nukus", aliases: ["nukus", "нукус"] },
  { label: "Andijon", lat: 40.7833, lon: 72.3333, city: "Andijon", aliases: ["andijon", "andijan", "андижон", "андижан"] },
  { label: "Buxoro", lat: 39.7747, lon: 64.4286, city: "Buxoro", aliases: ["buxoro", "bukhara", "buhoro", "бухоро", "бухара"] },
  { label: "Farg'ona", lat: 40.3864, lon: 71.7864, city: "Farg'ona", aliases: ["fargona", "ferghana", "fergana", "фаргона", "фергана"] },
  { label: "Jizzax", lat: 40.1158, lon: 67.8422, city: "Jizzax", aliases: ["jizzax", "jizzakh", "jizax", "жиззах", "джизак"] },
  { label: "Namangan", lat: 40.9983, lon: 71.6726, city: "Namangan", aliases: ["namangan", "наманган"] },
  { label: "Navoiy", lat: 40.0844, lon: 65.3792, city: "Navoiy", aliases: ["navoiy", "navoi", "навоий", "навои"] },
  { label: "Qarshi", lat: 38.8606, lon: 65.7847, city: "Qarshi", aliases: ["qarshi", "karshi", "карши", "қарши"] },
  { label: "Samarqand", lat: 39.6542, lon: 66.9597, city: "Samarqand", aliases: ["samarqand", "samarkand", "самарканд", "самарқанд"] },
  { label: "Guliston", lat: 40.4897, lon: 68.7842, city: "Guliston", aliases: ["guliston", "gulistan", "гулистон", "гулистан"] },
  { label: "Termiz", lat: 37.2242, lon: 67.2783, city: "Termiz", aliases: ["termiz", "termez", "термиз", "термез"] },
  { label: "Urganch", lat: 41.5500, lon: 60.6333, city: "Urganch", aliases: ["urganch", "urgench", "урганч", "ургенч"] },
  { label: "Nurafshon", lat: 41.0167, lon: 69.3500, city: "Nurafshon", aliases: ["nurafshon", "nurafshan", "tuytepa", "нурафшон"] },

  // --- Boshqa yirik shaharlar ---
  { label: "Chirchiq", lat: 41.4689, lon: 69.5822, city: "Chirchiq", aliases: ["chirchiq", "chirchik", "чирчиқ", "чирчик"] },
  { label: "Angren", lat: 41.0167, lon: 70.1436, city: "Angren", aliases: ["angren", "ангрен"] },
  { label: "Olmaliq", lat: 40.8447, lon: 69.5983, city: "Olmaliq", aliases: ["olmaliq", "almalyk", "almalik", "олмалиқ", "алмалык"] },
  { label: "Bekobod", lat: 40.2206, lon: 69.2694, city: "Bekobod", aliases: ["bekobod", "bekabad", "бекобод", "бекабад"] },
  { label: "Yangiyo'l", lat: 41.1128, lon: 69.0481, city: "Yangiyo'l", aliases: ["yangiyol", "yangiyul", "янгийул", "янгиюль"] },
  { label: "Qo'qon", lat: 40.5286, lon: 70.9425, city: "Qo'qon", aliases: ["qoqon", "kokand", "qokon", "қўқон", "коканд"] },
  { label: "Marg'ilon", lat: 40.4711, lon: 71.7247, city: "Marg'ilon", aliases: ["margilon", "margilan", "маргилон", "маргилан"] },
  { label: "Xiva", lat: 41.3783, lon: 60.3639, city: "Xiva", aliases: ["xiva", "khiva", "хива"] },
  { label: "Shahrisabz", lat: 39.0578, lon: 66.8347, city: "Shahrisabz", aliases: ["shahrisabz", "shakhrisabz", "шахрисабз"] },
  { label: "Denov", lat: 38.2678, lon: 67.8944, city: "Denov", aliases: ["denov", "денов"] },
  { label: "Kattaqo'rg'on", lat: 39.9003, lon: 66.2564, city: "Kattaqo'rg'on", aliases: ["kattaqorgon", "kattakurgan", "каттақўрғон", "каттакурган"] },
  { label: "Zarafshon", lat: 41.5786, lon: 64.2050, city: "Zarafshon", aliases: ["zarafshon", "zarafshan", "зарафшон"] },
  { label: "Uchquduq", lat: 42.1553, lon: 63.5556, city: "Uchquduq", aliases: ["uchquduq", "uchkuduk", "учқудуқ", "учкудук"] },
  { label: "Muborak", lat: 39.2542, lon: 65.1608, city: "Muborak", aliases: ["muborak", "mubarek", "муборак"] },
  { label: "G'uzor", lat: 38.6217, lon: 66.2517, city: "G'uzor", aliases: ["guzor", "гузор", "ғузор"] },
  { label: "Qo'ng'irot", lat: 43.0778, lon: 58.9014, city: "Qo'ng'irot", aliases: ["qongirot", "kungrad", "қўнғирот", "кунград"] },
  { label: "Xorazm", lat: 41.5500, lon: 60.6333, city: "Urganch", aliases: ["xorazm", "khorezm", "хоразм", "хорезм"] },
  { label: "Asaka", lat: 40.6408, lon: 72.2394, city: "Asaka", aliases: ["asaka", "асака"] },
  { label: "Chust", lat: 41.0000, lon: 71.2333, city: "Chust", aliases: ["chust", "чуст"] },
  { label: "Rishton", lat: 40.3567, lon: 71.2839, city: "Rishton", aliases: ["rishton", "риштон"] },
  { label: "Urgut", lat: 39.4008, lon: 67.2422, city: "Urgut", aliases: ["urgut", "ургут"] },
  { label: "Jomboy", lat: 39.7167, lon: 67.1333, city: "Jomboy", aliases: ["jomboy", "djambay", "джамбай"] },
];

// --- text normalisation ------------------------------------------------------

// Cyrillic -> Latin, so "Чилонзор" and "Chilonzor" collapse to the same key.
const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ў: "o", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

// Everything that varies without changing the word: case, apostrophes (o'/o`/oʻ
// are all the same letter to a person typing fast), punctuation, and repeated
// spaces. Also folds the endings that differ between how a place is named and
// how people say it -- "Chilonzor tumani", "Toshkent shahri".
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[а-яёғқўҳ]/g, (ch) => (ch in CYRILLIC ? CYRILLIC[ch] : ch))
    .replace(/['''`ʻʼ’]/g, "")
    .replace(/\b(tumani|tuman|shahri|shahar|viloyati|viloyat|rayon|rayoni|district|city|obl|область|район|город)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Every alias, normalised once at load, pointing back at its place.
const ALIAS_INDEX = new Map();
for (const place of PLACES) {
  for (const alias of [place.label, ...place.aliases]) {
    ALIAS_INDEX.set(normalize(alias), place);
  }
}

// --- typo tolerance ----------------------------------------------------------

// Standard Levenshtein, capped: anything further than `max` is not a typo,
// it's a different word, and bailing out early keeps this cheap.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1; // no cell in this row can lead anywhere good
    prev = curr;
  }
  return prev[b.length];
}

// How many typos to forgive, by word length. One slip in a short word like
// "Xiva" would otherwise match half the catalogue, so short words get no
// slack at all -- this is what keeps "asdfgh" from resolving to a real place.
function typoBudget(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

// Uzbek (and Russian) glue a case ending straight onto a place name --
// "Yunusobodda yashayman", "Toshkentdan", "Samarqandga". Without this, the
// name is there in plain sight and still doesn't match. Deliberately a fixed
// list rather than "any few trailing letters", which would happily turn
// unrelated words into places.
const CASE_SUFFIXES = ["gacha", "liklar", "dagi", "ning", "dan", "lik", "da", "ga", "ni", "e"];

// Longest suffix first, so "dan" is tried before "da" -- otherwise
// "Toshkentdan" would be left as "Toshkentn".
function stripCaseSuffix(word) {
  for (const suffix of CASE_SUFFIXES) {
    // Only worth stripping if what remains is still a plausible name.
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// "lat, lon" as stored when somebody taps the "share my location" button.
const COORD_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

function parseCoords(text) {
  const m = COORD_RE.exec(String(text || ""));
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

// Resolves free text to a catalogue entry, or null when it plainly isn't a
// place. Exact alias first, then "the input contains a known place name"
// (so "Chilonzor 5-kvartal" still works), then a typo-tolerant pass.
function matchPlace(text) {
  const key = normalize(text);
  if (!key) return null;

  // The same answer with any case ending taken off each word, tried as a
  // second candidate everywhere below: "yunusobodda" -> "yunusobod".
  const stripped = key.split(" ").map(stripCaseSuffix).join(" ");
  const keys = stripped === key ? [key] : [key, stripped];

  for (const candidate of keys) {
    const exact = ALIAS_INDEX.get(candidate);
    if (exact) return exact;
  }

  // A known place appearing as a whole word inside a longer answer.
  for (const candidate of keys) {
    for (const [alias, place] of ALIAS_INDEX) {
      if (alias.length < 4) continue;
      const re = new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
      if (re.test(candidate)) return place;
    }
  }

  // Typos, closest match wins.
  let best = null;
  let bestDist = Infinity;
  for (const candidate of keys) {
    for (const [alias, place] of ALIAS_INDEX) {
      const budget = typoBudget(Math.max(alias.length, candidate.length));
      if (budget === 0) continue;
      const dist = editDistance(candidate, alias, budget);
      if (dist <= budget && dist < bestDist) {
        best = place;
        bestDist = dist;
      }
    }
  }
  return best;
}

// What the wizard calls. Returns the canonical label to store (so the whole
// database ends up spelled one way, whatever people typed) plus coordinates,
// or null when the answer isn't a recognisable place at all.
function resolveLocation(text) {
  const coords = parseCoords(text);
  if (coords) {
    // A real GPS pin: name it after the nearest catalogue entry when there is
    // one close enough, so the profile reads "Chilonzor" rather than a pair
    // of numbers -- but keep the exact coordinates for distance maths.
    const near = nearestPlace(coords, 25);
    return { label: near ? near.label : "Joylashuv", lat: coords.lat, lon: coords.lon, fromCoords: true };
  }
  const place = matchPlace(text);
  if (!place) return null;
  return { label: place.label, lat: place.lat, lon: place.lon, fromCoords: false };
}

// --- distance ----------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

function nearestPlace(coords, maxKm = Infinity) {
  let best = null;
  let bestDist = Infinity;
  for (const place of PLACES) {
    const d = haversineKm(coords, place);
    if (d < bestDist) {
      best = place;
      bestDist = d;
    }
  }
  return bestDist <= maxKm ? best : null;
}

// Turns whatever is stored on a profile (a canonical label, an old free-text
// value from before this existed, or "lat, lon") into coordinates, or null
// when it can't be placed. Never throws -- an unrecognisable legacy value
// simply means no distance is shown for that profile.
function coordsForStored(stored) {
  const coords = parseCoords(stored);
  if (coords) return coords;
  const place = matchPlace(stored);
  return place ? { lat: place.lat, lon: place.lon } : null;
}

// Below this, the honest answer is "nearby", not a number. What the
// catalogue actually stores is one point per district, so two people both
// listed as "Chilonzor" are some unknown distance apart within it -- printing
// "<1 km" would claim a precision that simply isn't there.
const NEAR_THRESHOLD_KM = 2;

// Rounded the way a person reads a distance: single digits keep one decimal
// only when it's meaningful, anything further is a whole number.
function formatKm(km) {
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, "")} km`;
  return `${Math.round(km)} km`;
}

// The line the profile card shows: "Mirobod (4 km)" when both sides can be
// placed, plain "Mirobod" when they can't. Deliberately silent on failure --
// a missing distance is a small loss, a wrong one is worse than none.
function locationWithDistance(candidateLocation, viewerLocation, { nearText = "yaqin" } = {}) {
  const label = String(candidateLocation || "").trim();
  if (!label) return "";

  const a = coordsForStored(candidateLocation);
  const b = coordsForStored(viewerLocation);
  if (!a || !b) return label;

  const km = haversineKm(a, b);
  return `${label} (${km < NEAR_THRESHOLD_KM ? nearText : formatKm(km)})`;
}

module.exports = {
  resolveLocation,
  locationWithDistance,
  coordsForStored,
  haversineKm,
  formatKm,
  // Exposed for tests: the matching rules are the part most likely to drift.
  __test: { normalize, matchPlace, parseCoords, editDistance, typoBudget, NEAR_THRESHOLD_KM, PLACES },
};
