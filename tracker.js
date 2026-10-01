// Andrew's Meal Tracker: pure logic, no DOM. Used by index.html and by tracker.test.js.
(function () {
  "use strict";

  const PREFIX = "andrew-tracker:";
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const OPTIONS = ["A", "B"];

  const pad = (n) => String(n).padStart(2, "0");
  const round1 = (x) => Math.round(x * 10) / 10;
  const num = (x) => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  // "YYYY-MM-DD" from the device's local clock (toISOString would give UTC).
  function localDateString(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function weekdayName(date) {
    return DAYS[date.getDay()];
  }

  function britishDate(date) {
    return weekdayName(date) + " " + date.getDate() + " " + MONTHS[date.getMonth()];
  }

  function storageKey(dateString) {
    return PREFIX + dateString;
  }

  function newState(planDay, option) {
    return { planDay, option, checked: [], cans: 0, extras: [] };
  }

  function findDay(plan, planDay) {
    return plan.days.find((d) => d.day === planDay) || null;
  }

  function mealsFor(plan, planDay, option) {
    const day = findDay(plan, planDay);
    return (day && day.options[option]) || [];
  }

  function idsFor(plan, planDay, option) {
    return new Set(mealsFor(plan, planDay, option).flatMap((m) => m.items.map((i) => i.id)));
  }

  function cleanExtra(e) {
    if (!e || typeof e !== "object") return null;
    const name = typeof e.name === "string" && e.name.trim() ? e.name.trim().slice(0, 60) : "Extra";
    return { name, kcal: num(e.kcal), protein: num(e.protein), carbs: num(e.carbs), fat: num(e.fat) };
  }

  // Turn whatever came out of storage into a valid state, or fall back.
  function migrateState(plan, raw, fallback) {
    if (!raw || typeof raw !== "object") return fallback;
    if (!findDay(plan, raw.planDay) || !OPTIONS.includes(raw.option)) return fallback;
    const checked = Array.isArray(raw.checked)
      ? [...new Set(raw.checked.filter((id) => typeof id === "string"))]
      : [];
    const maxCans = plan.drinks.cans;
    const cans = Math.min(maxCans, Math.max(0, Math.floor(num(raw.cans))));
    const extras = Array.isArray(raw.extras) ? raw.extras.map(cleanExtra).filter(Boolean) : [];
    return { planDay: raw.planDay, option: raw.option, checked, cans, extras };
  }

  function computeTotals(plan, state) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const ticked = new Set(state.checked);
    for (const meal of mealsFor(plan, state.planDay, state.option)) {
      for (const it of meal.items) {
        if (!ticked.has(it.id)) continue;
        t.kcal += it.kcal; t.protein += it.protein; t.carbs += it.carbs; t.fat += it.fat;
      }
    }
    for (const e of state.extras || []) {
      t.kcal += num(e.kcal); t.protein += num(e.protein); t.carbs += num(e.carbs); t.fat += num(e.fat);
    }
    const cans = state.option === "B" ? state.cans || 0 : 0;
    const drinksKcal = cans * plan.drinks.kcalPerCan;
    const drinksCarbs = cans * plan.drinks.carbsPerCan;
    const kcal = Math.round(t.kcal);
    return {
      kcal,
      protein: round1(t.protein),
      carbs: round1(t.carbs),
      fat: round1(t.fat),
      drinksKcal,
      drinksCarbs,
      withDrinksKcal: kcal + drinksKcal,
    };
  }

  function toggleItem(state, id) {
    const checked = state.checked.includes(id)
      ? state.checked.filter((x) => x !== id)
      : state.checked.concat(id);
    return { ...state, checked };
  }

  function setMealChecked(state, meal, checked) {
    const ids = meal.items.map((i) => i.id);
    const rest = state.checked.filter((x) => !ids.includes(x));
    return { ...state, checked: checked ? rest.concat(ids) : rest };
  }

  function setOption(plan, state, option) {
    const keep = idsFor(plan, state.planDay, option);
    return {
      ...state,
      option,
      checked: state.checked.filter((id) => keep.has(id)),
      cans: option === "B" ? state.cans : 0,
    };
  }

  function setPlanDay(plan, state, planDay) {
    const keep = idsFor(plan, planDay, state.option);
    return { ...state, planDay, checked: state.checked.filter((id) => keep.has(id)) };
  }

  // Given every storage key, return the dated tracker keys to delete (all but the newest keepDays).
  function pruneKeys(keys, keepDays) {
    const keep = keepDays == null ? 14 : keepDays;
    const re = /^andrew-tracker:\d{4}-\d{2}-\d{2}$/;
    const dated = keys.filter((k) => re.test(k)).sort().reverse();
    return dated.slice(keep);
  }

  function nextTheme(current) {
    return current === "dark" ? "light" : "dark";
  }

  // A stored choice wins; with nothing valid stored, follow the device.
  function initialTheme(stored, prefersDark) {
    if (stored === "light" || stored === "dark") return stored;
    return prefersDark ? "dark" : "light";
  }

  const api = {
    storageKey, localDateString, weekdayName, britishDate, newState, migrateState,
    computeTotals, toggleItem, setMealChecked, setOption, setPlanDay, pruneKeys,
    nextTheme, initialTheme,
  };
  if (typeof module !== "undefined") module.exports = api; else window.Tracker = api;
})();
