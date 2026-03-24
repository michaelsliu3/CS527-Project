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
const CATEGORY_NAME = process.env.AUCTION_SEED_CATEGORY || "Sedans";
const COUNT = Math.max(1, Number.parseInt(process.env.AUCTION_SEED_COUNT || "20", 10) || 20);
const MANIFEST_PATH = process.env.AUCTION_SEED_MANIFEST || DEFAULT_MANIFEST_PATH;
const TITLE_KEYWORD = (process.env.AUCTION_SEED_TITLE_KEYWORD || "").trim().toLowerCase();

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

function selectAssets(assets, count) {
  const base = assets.filter((asset) => asset?.make && asset?.model && Number.isFinite(asset?.year));
  if (!TITLE_KEYWORD) {
    return base.slice(0, count);
  }

  const filtered = base.filter((asset) =>
    String(asset?.title || "").toLowerCase().includes(TITLE_KEYWORD),
  );
  return filtered.slice(0, count);
}

function buildAuctionPayload(asset, categoryId, fieldIds, indexOffset) {
  const now = Date.now();
  const closeAt = new Date(now + (48 + indexOffset) * 60 * 60 * 1000);
  const initialPrice = 10000 + indexOffset * 250;
  const bidIncrement = 100;
  const reservePrice = initialPrice + 500;
  const mileage = 5000 + (indexOffset % 15) * 1750;

  return {
    title: `${asset.make} ${asset.model} ${asset.year}`,
    description: `Temp seed auction from GT7 manifest (${asset.externalId}).`,
    categoryId,
    initialPrice,
    bidIncrement,
    reservePrice,
    closeDateTime: closeAt.toISOString(),
    fieldValues: [
      { fieldId: fieldIds.make, value: String(asset.make) },
      { fieldId: fieldIds.model, value: String(asset.model) },
      { fieldId: fieldIds.year, value: String(asset.year) },
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
  const selectedCategory = categories.find((category) => category?.name === CATEGORY_NAME);
  if (!selectedCategory) {
    const availableNames = categories.map((category) => category?.name).filter(Boolean).join(", ");
    throw new Error(`Category "${CATEGORY_NAME}" not found. Available: ${availableNames}`);
  }

  const fieldsResult = await requestJson(
    `${API_BASE_URL}/categories/${selectedCategory.id}/fields`,
  );
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

  let createdCount = 0;
  const failures = [];

  for (let i = 0; i < assets.length; i += 1) {
    const asset = assets[i];
    const payload = buildAuctionPayload(asset, selectedCategory.id, fieldIds, i);

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
    console.log(`[OK] #${createResult.body?.id ?? "?"} ${payload.title}`);
  }

  console.log(`\nCreated ${createdCount}/${assets.length} auctions in "${selectedCategory.name}".`);
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
