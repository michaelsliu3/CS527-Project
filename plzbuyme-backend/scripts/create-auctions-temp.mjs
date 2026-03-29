#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_API_BASE_URL = "http://localhost:5081/api";
const DEFAULT_MANIFEST_PATH = path.resolve(
  __dirname,
  "../../plzbuyme-cdn/tools/car-assets/manifests/gt7-car-thumbnails.manifest.json",
);

const API_BASE_URL = (process.env.API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
const USERNAME = process.env.AUCTION_SEED_USERNAME || "seller1";
const PASSWORD = process.env.AUCTION_SEED_PASSWORD || "password123";
const CATEGORY_NAME = process.env.AUCTION_SEED_CATEGORY || "auto";
const COUNT = Math.max(1, Number.parseInt(process.env.AUCTION_SEED_COUNT || "20", 10) || 20);
const MANIFEST_PATH = process.env.AUCTION_SEED_MANIFEST || DEFAULT_MANIFEST_PATH;
const TITLE_KEYWORD = (process.env.AUCTION_SEED_TITLE_KEYWORD || "").trim().toLowerCase();

const CATEGORY_NAMES = {
  sedans: "Sedans",
  suvs: "SUVs",
  trucks: "Trucks",
  sportsCars: "Sports Cars",
  electric: "Electric",
};

const FIELD_NAMES = {
  make: "Make",
  model: "Model",
  year: "Year",
  mileage: "Mileage",
  condition: "Condition",
  transmission: "Transmission",
  fuelType: "Fuel Type",
  exteriorColor: "Exterior Color",
};

function flattenCategories(categories) {
  const result = [];
  const stack = Array.isArray(categories) ? [...categories] : [];
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    result.push(current);
    if (Array.isArray(current.children) && current.children.length > 0) {
      stack.push(...current.children);
    }
  }
  return result;
}

function requireFieldIdByName(fields, name) {
  const field = fields.find((candidate) => candidate.fieldName === name);
  if (!field) {
    throw new Error(`Category is missing required field "${name}".`);
  }
  return field.id;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function selectAssets(assets, count) {
  const base = assets.filter((asset) => asset?.make && asset?.model);
  const pool = TITLE_KEYWORD
    ? base.filter((asset) =>
        String(asset?.title || "").toLowerCase().includes(TITLE_KEYWORD),
      )
    : [...base];
  shuffleInPlace(pool);
  return pool.slice(0, Math.min(count, pool.length));
}

function resolveAssetYear(asset) {
  if (Number.isFinite(asset?.year)) {
    return Number(asset.year);
  }

  const title = String(asset?.title || "");
  const twoDigitMatch = title.match(/'(\d{2})(?!.*'\d{2})/);
  if (twoDigitMatch) {
    const twoDigitYear = Number.parseInt(twoDigitMatch[1], 10);
    if (!Number.isNaN(twoDigitYear)) {
      return twoDigitYear <= 29 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
    }
  }

  const fullYearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (fullYearMatch) {
    const parsed = Number.parseInt(fullYearMatch[1], 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 2025;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizedCarText(asset) {
  return `${asset?.title || ""} ${asset?.make || ""} ${asset?.model || ""}`.toLowerCase();
}

function inferCategoryName(asset) {
  const text = normalizedCarText(asset);

  const electricKeywords = [
    "tesla",
    "ev",
    "electric",
    "leaf",
    "bolt",
    "ioniq",
    "rivian",
    "taycan",
    "e-tron",
    "id.",
    "model 3",
    "model s",
    "model x",
    "model y",
  ];
  if (electricKeywords.some((keyword) => text.includes(keyword))) {
    return CATEGORY_NAMES.electric;
  }

  const truckKeywords = [
    "truck",
    "pickup",
    "f-150",
    "silverado",
    "sierra",
    "ram",
    "tacoma",
    "tundra",
    "hilux",
    "r1t",
  ];
  if (truckKeywords.some((keyword) => text.includes(keyword))) {
    return CATEGORY_NAMES.trucks;
  }

  const suvKeywords = [
    "suv",
    "rav4",
    "cr-v",
    "wrangler",
    "cherokee",
    "bronco",
    "defender",
    "cayenne",
    "tiguan",
    "forester",
    "outback",
    "x5",
    "q5",
    "glc",
  ];
  if (suvKeywords.some((keyword) => text.includes(keyword))) {
    return CATEGORY_NAMES.suvs;
  }

  const sportsKeywords = [
    "gt-r",
    "gtr",
    "911",
    "corvette",
    "mustang",
    "supra",
    "ferrari",
    "lamborghini",
    "mclaren",
    "porsche",
    "nsx",
    "viper",
    "amg gt",
    "zonda",
    "skyline",
    "rx-7",
    "mx-5",
    "miata",
  ];
  if (sportsKeywords.some((keyword) => text.includes(keyword))) {
    return CATEGORY_NAMES.sportsCars;
  }

  return CATEGORY_NAMES.sedans;
}

function buildAuctionPayload(asset, categoryId, fieldIds) {
  const now = Date.now();
  const year = resolveAssetYear(asset);
  const closeAt = new Date(now + randomInt(6, 120) * 60 * 60 * 1000);
  const initialPrice = randomInt(6500, 85000);
  const bidIncrement = randomInt(50, 500);
  const reservePrice = initialPrice + randomInt(300, 7000);
  const mileage = randomInt(500, 180000);

  return {
    title: `${asset.make} ${asset.model} ${year}`,
    description: `Temp seed auction from GT7 manifest (${asset.externalId}).`,
    categoryId,
    initialPrice,
    bidIncrement,
    reservePrice,
    closeDateTime: closeAt.toISOString(),
    fieldValues: [
      { fieldId: fieldIds.make, value: String(asset.make) },
      { fieldId: fieldIds.model, value: String(asset.model) },
      { fieldId: fieldIds.year, value: String(year) },
      { fieldId: fieldIds.mileage, value: String(mileage) },
      { fieldId: fieldIds.condition, value: "Good" },
      { fieldId: fieldIds.transmission, value: "Automatic" },
      { fieldId: fieldIds.fuelType, value: "Gasoline" },
      { fieldId: fieldIds.exteriorColor, value: String(asset.color || "Unknown") },
    ],
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const manifestRaw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const assets = selectAssets(manifest.assets || [], COUNT);

  if (assets.length === 0) {
    throw new Error(
      TITLE_KEYWORD
        ? `No usable manifest assets found for keyword "${TITLE_KEYWORD}".`
        : "No usable manifest assets found.",
    );
  }

  console.log(
    `Using ${assets.length} manifest cars from: ${MANIFEST_PATH}${TITLE_KEYWORD ? ` (keyword: ${TITLE_KEYWORD})` : ""}`,
  );

  const loginResult = await requestJson(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!loginResult.ok || !loginResult.body?.token) {
    throw new Error(
      `Login failed (${loginResult.status}): ${JSON.stringify(loginResult.body)}`,
    );
  }

  const token = loginResult.body.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const categoriesResult = await requestJson(`${API_BASE_URL}/categories`);
  if (!categoriesResult.ok || !Array.isArray(categoriesResult.body)) {
    throw new Error(
      `Failed to fetch categories (${categoriesResult.status}): ${JSON.stringify(categoriesResult.body)}`,
    );
  }

  const categories = flattenCategories(categoriesResult.body);
  const categoryByName = new Map(
    categories.filter((category) => category?.name).map((category) => [category.name, category]),
  );
  const fieldIdsByCategoryId = new Map();

  async function resolveFieldIdsForCategory(categoryId) {
    if (fieldIdsByCategoryId.has(categoryId)) {
      return fieldIdsByCategoryId.get(categoryId);
    }

    const fieldsResult = await requestJson(`${API_BASE_URL}/categories/${categoryId}/fields`);
    if (!fieldsResult.ok || !Array.isArray(fieldsResult.body)) {
      throw new Error(
        `Failed to fetch category fields (${fieldsResult.status}): ${JSON.stringify(fieldsResult.body)}`,
      );
    }

    const fields = fieldsResult.body;
    const fieldIds = {
      make: requireFieldIdByName(fields, FIELD_NAMES.make),
      model: requireFieldIdByName(fields, FIELD_NAMES.model),
      year: requireFieldIdByName(fields, FIELD_NAMES.year),
      mileage: requireFieldIdByName(fields, FIELD_NAMES.mileage),
      condition: requireFieldIdByName(fields, FIELD_NAMES.condition),
      transmission: requireFieldIdByName(fields, FIELD_NAMES.transmission),
      fuelType: requireFieldIdByName(fields, FIELD_NAMES.fuelType),
      exteriorColor: requireFieldIdByName(fields, FIELD_NAMES.exteriorColor),
    };
    fieldIdsByCategoryId.set(categoryId, fieldIds);
    return fieldIds;
  }

  const fallbackCategory = categoryByName.get(CATEGORY_NAMES.sedans);
  if (!fallbackCategory) {
    const availableNames = categories.map((category) => category?.name).filter(Boolean).join(", ");
    throw new Error(`Required fallback category "Sedans" not found. Available: ${availableNames}`);
  }

  let createdCount = 0;
  const failures = [];
  const createdByCategory = new Map();

  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i];
    const inferredName = CATEGORY_NAME.toLowerCase() === "auto" ? inferCategoryName(asset) : CATEGORY_NAME;
    const selectedCategory = categoryByName.get(inferredName) ?? fallbackCategory;
    const fieldIds = await resolveFieldIdsForCategory(selectedCategory.id);
    const payload = buildAuctionPayload(asset, selectedCategory.id, fieldIds);

    const createResult = await requestJson(`${API_BASE_URL}/auctions/create`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    if (!createResult.ok) {
      failures.push({
        title: payload.title,
        status: createResult.status,
        error: createResult.body,
      });
      console.error(
        `[FAIL] ${payload.title} (${createResult.status}): ${JSON.stringify(createResult.body)}`,
      );
      continue;
    }

    createdCount += 1;
    createdByCategory.set(
      selectedCategory.name,
      (createdByCategory.get(selectedCategory.name) ?? 0) + 1,
    );
    console.log(`[OK] #${createResult.body?.id ?? "?"} ${payload.title}`);
  }

  const categoryBreakdown = [...createdByCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");
  console.log(
    `\nCreated ${createdCount}/${assets.length} auctions.${categoryBreakdown ? ` By category: ${categoryBreakdown}` : ""}`,
  );
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
