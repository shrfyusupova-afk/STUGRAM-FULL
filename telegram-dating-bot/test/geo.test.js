// Location input used to be any text at all, so a handful of mashed letters
// became somebody's permanent location. These tests pin down both halves of
// the fix: real places (however they're spelled) resolve, and things that are
// not places are refused -- plus the distance line that resolving makes
// possible in the first place.
const assert = require("assert");
const geo = require("../src/geo");
const { resolveLocation, locationWithDistance, haversineKm } = geo;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- what must resolve -------------------------------------------------------

test("the same place spelled six different ways all resolve to one label", () => {
  for (const spelling of ["Chilonzor", "chilonzor", "CHILONZOR", "chilanzar", "Чилонзор", "чиланзар"]) {
    const r = resolveLocation(spelling);
    assert.ok(r, `"${spelling}" should resolve`);
    assert.strictEqual(r.label, "Chilonzor", `"${spelling}" -> ${r && r.label}`);
  }
});

test("apostrophe variants are the same letter to a person typing fast", () => {
  for (const spelling of ["Qo'qon", "Qo`qon", "Qoqon", "qo’qon", "Kokand"]) {
    const r = resolveLocation(spelling);
    assert.ok(r, `"${spelling}" should resolve`);
    assert.strictEqual(r.label, "Qo'qon");
  }
});

test("the words people add around a place name are ignored", () => {
  assert.strictEqual(resolveLocation("Chilonzor tumani").label, "Chilonzor");
  assert.strictEqual(resolveLocation("Toshkent shahri").label, "Toshkent");
  assert.strictEqual(resolveLocation("Samarqand viloyati").label, "Samarqand");
});

test("a place named inside a longer answer is still found", () => {
  assert.strictEqual(resolveLocation("Chilonzor 5-kvartal").label, "Chilonzor");
  assert.strictEqual(resolveLocation("men Yunusobodda yashayman").label, "Yunusobod");
});

test("Uzbek case endings glued onto the name do not hide it", () => {
  // How people actually answer "qayerdansiz?" -- the ending is part of the
  // word, so a plain equality check never sees the place at all.
  assert.strictEqual(resolveLocation("Toshkentdan").label, "Toshkent");
  assert.strictEqual(resolveLocation("Chilonzorda").label, "Chilonzor");
  assert.strictEqual(resolveLocation("Samarqandga").label, "Samarqand");
  assert.strictEqual(resolveLocation("Yunusobodda").label, "Yunusobod");
});

test("a shared GPS pin is named after the district it falls in", () => {
  // Somewhere in Mirobod.
  const r = resolveLocation("41.295, 69.29");
  assert.ok(r);
  assert.strictEqual(r.label, "Mirobod");
  assert.strictEqual(r.fromCoords, true);
});

// --- what must NOT resolve ---------------------------------------------------
//
// This is the actual reported problem: "bir odamlar besh oltita harif
// bosvorishi ham mumkin" -- somebody mashing five or six letters.

test("mashed letters are refused, not stored as a location", () => {
  for (const junk of ["asdfgh", "qwerty", "xxxxx", "aaaaaa", "zzzzzz", "12345", "...", "a", "hjkl", "sdfsdf"]) {
    assert.strictEqual(resolveLocation(junk), null, `"${junk}" must be refused`);
  }
});

test("a short real-looking word is not stretched into a real place", () => {
  // Four letters or fewer get no typo budget at all -- otherwise "Xiva"
  // would sit one edit away from half the catalogue.
  assert.strictEqual(resolveLocation("xiwa"), null);
  assert.strictEqual(resolveLocation("abcd"), null);
});

test("coordinates outside the real range are not treated as a pin", () => {
  assert.strictEqual(resolveLocation("999, 999"), null);
  assert.strictEqual(resolveLocation("91, 0"), null);
});

// --- distance ----------------------------------------------------------------

test("a known distance comes out roughly right", () => {
  // Tashkent -> Samarkand is about 270 km as the crow flies.
  const km = haversineKm({ lat: 41.2995, lon: 69.2401 }, { lat: 39.6542, lon: 66.9597 });
  assert.ok(km > 250 && km < 290, `expected ~270 km, got ${km.toFixed(1)}`);
});

test("the card shows the place with the distance from whoever is looking", () => {
  const line = locationWithDistance("Mirobod", "Chilonzor");
  assert.ok(/^Mirobod \(\d+(\.\d+)? km\)$/.test(line), `unexpected: ${line}`);
});

test("two people in the same district get an honest 'nearby', not a fake precise number", () => {
  // The catalogue holds ONE point per district, so both sides resolve to the
  // identical coordinate. Printing "<1 km" there would claim a precision that
  // does not exist -- they could be at opposite ends of Chilonzor.
  const line = locationWithDistance("Chilonzor", "Chilonzor", { nearText: "yaqin" });
  assert.strictEqual(line, "Chilonzor (yaqin)");
  assert.ok(!line.includes("km"), "same-district must not print a distance in km");
});

test("an unplaceable location on either side simply shows no distance", () => {
  // Profiles saved before this existed can hold anything at all. A missing
  // distance is a small loss; a wrong one would be worse than none.
  assert.strictEqual(locationWithDistance("Mirobod", "asdfgh"), "Mirobod");
  assert.strictEqual(locationWithDistance("qwerty", "Mirobod"), "qwerty");
  assert.strictEqual(locationWithDistance("Mirobod", undefined), "Mirobod");
});

test("distance is measured from a GPS pin too, not only a named district", () => {
  const line = locationWithDistance("Samarqand", "41.2995, 69.2401");
  assert.ok(/^Samarqand \(2[0-9]{2} km\)$/.test(line), `unexpected: ${line}`);
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
