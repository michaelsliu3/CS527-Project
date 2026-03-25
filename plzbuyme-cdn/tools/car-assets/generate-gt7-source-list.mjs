#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GT7_CARLIST_URL = 'https://www.gran-turismo.com/us/gt7/carlist';
const GT7_HOST = 'https://www.gran-turismo.com';
const THUMBNAIL_BASE_PATH = '/common/dist/gt7/carlist/car_thumbnails';
const GT7_ASSET_BASE_PATH = '/common/dist/gt7/carlist/assets';
const DEFAULT_OUTPUT = 'manifests/gt7-car-thumbnails.manifest.json';

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'plzbuyme-cdn-car-assets/1.0',
      accept: 'text/html,application/javascript,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractBundleUrl(html) {
  const match = html.match(/src="(\/common\/dist\/gt7\/carlist\/assets\/index-[^"]+\.js)"/i);
  if (!match?.[1]) {
    throw new Error('Unable to locate GT7 car list JS bundle URL.');
  }

  return new URL(match[1], GT7_HOST).toString();
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCarIds(bundleSource) {
  const ids = new Set();

  const shotImageRegex = /car(\d{3,5})_[0-9]_[0-9]{2}\.jpg/gi;
  for (const match of bundleSource.matchAll(shotImageRegex)) {
    if (match[1]) ids.add(match[1]);
  }

  const sorted = [...ids].sort((a, b) => Number(a) - Number(b));
  if (sorted.length === 0) {
    throw new Error('No car IDs were discovered in GT7 bundle output.');
  }

  return sorted;
}

function extractCarViewAssets(bundleSource) {
  const viewsByCarId = new Map();
  const viewRegex = /"\.\.\/\.\.\/generated-assets\/images\/car_shots\/2k\/(car(\d{3,5})_([0-9])_([0-9]{2})\.jpg)":\(\)=>e\(\(\)=>import\("([^"]+)"\),\[\]\)/g;

  for (const match of bundleSource.matchAll(viewRegex)) {
    const filename = match[1];
    const carId = match[2];
    const view = Number.parseInt(match[3], 10);
    const angle = Number.parseInt(match[4], 10);
    const chunkPath = match[5];

    if (!viewsByCarId.has(carId)) {
      viewsByCarId.set(carId, new Map());
    }

    const key = `${view}_${angle}`;
    const existing = viewsByCarId.get(carId);
    if (!existing.has(key)) {
      existing.set(key, { view, angle, filename, chunkPath });
    }
  }

  for (const [carId, viewMap] of viewsByCarId.entries()) {
    const sorted = [...viewMap.values()].sort((a, b) => {
      if (a.view !== b.view) return a.view - b.view;
      if (a.angle !== b.angle) return a.angle - b.angle;
      return a.filename.localeCompare(b.filename);
    });
    viewsByCarId.set(carId, sorted);
  }

  return viewsByCarId;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function resolveHashedAssetPath(bundleUrl, chunkPath) {
  const chunkUrl = toAbsoluteChunkUrl(bundleUrl, chunkPath);
  const chunkSource = await fetchText(chunkUrl);
  const match = chunkSource.match(/"(\/common\/dist\/gt7\/carlist\/assets\/[^"]+\.jpg)"/);
  if (!match?.[1]) {
    throw new Error(`Unable to resolve image asset URL from chunk ${chunkUrl}`);
  }

  return new URL(match[1], GT7_HOST).toString();
}

async function resolveCarViewAssets(bundleUrl, viewAssetsByCarId) {
  const unresolved = [];
  for (const [carId, viewAssets] of viewAssetsByCarId.entries()) {
    for (const viewAsset of viewAssets) {
      unresolved.push({ carId, ...viewAsset });
    }
  }

  const chunkToResolvedUrl = new Map();
  await mapWithConcurrency(unresolved, 24, async (item) => {
    if (!chunkToResolvedUrl.has(item.chunkPath)) {
      const resolvedUrl = await resolveHashedAssetPath(bundleUrl, item.chunkPath);
      chunkToResolvedUrl.set(item.chunkPath, resolvedUrl);
    }
  });

  const resolvedByCarId = new Map();
  for (const [carId, viewAssets] of viewAssetsByCarId.entries()) {
    resolvedByCarId.set(
      carId,
      viewAssets.map((viewAsset) => ({
        view: viewAsset.view,
        angle: viewAsset.angle,
        sourceUrl: chunkToResolvedUrl.get(viewAsset.chunkPath) ?? `${GT7_HOST}${GT7_ASSET_BASE_PATH}/${viewAsset.filename}`
      }))
    );
  }

  return resolvedByCarId;
}

function selectDetailSourceUrl(galleryUrls, fallbackUrl) {
  const preferredKeys = ['2_01', '2_02', '3_01', '1_01'];
  for (const key of preferredKeys) {
    if (galleryUrls[key]) return galleryUrls[key];
  }

  const firstGalleryUrl = Object.values(galleryUrls)[0];
  return firstGalleryUrl ?? fallbackUrl;
}

function extractChunkPath(bundleSource, generatedAssetPath) {
  const escapedPath = escapeRegex(generatedAssetPath);
  const pattern = new RegExp(`"${escapedPath}":\\(\\)=>e\\(\\(\\)=>import\\("([^"]+)"\\)`, 'i');
  const match = bundleSource.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Unable to find chunk path for ${generatedAssetPath}`);
  }

  return match[1];
}

function toAbsoluteChunkUrl(bundleUrl, chunkPath) {
  const normalized = chunkPath.replace(/^\.\//, '');
  return new URL(normalized, bundleUrl).toString();
}

function parseExportedObject(chunkSource) {
  const sanitized = chunkSource.replace(/export\{[\s\S]*$/, '').trim();
  const match = sanitized.match(/const\s+[a-zA-Z_$][\w$]*\s*=\s*(\{[\s\S]*\})\s*;?$/);
  if (!match?.[1]) {
    throw new Error('Unable to parse module object export.');
  }

  const objectLiteral = match[1];
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${objectLiteral});`)();
}

function normalizeYear(twoDigitYear) {
  const yearValue = Number.parseInt(twoDigitYear, 10);
  if (Number.isNaN(yearValue)) return null;

  // GT7 mostly includes classic and modern vehicles; this pivot keeps old cars in 1900s.
  return yearValue <= 29 ? 2000 + yearValue : 1900 + yearValue;
}

function parseModelAndYear(nameLong, make) {
  if (!nameLong) {
    return {
      model: null,
      year: null,
      needsReview: true
    };
  }

  const yearMatch = nameLong.match(/(?:^|\s)'(\d{2})(?!.*'\d{2})/);
  const year = yearMatch?.[1] ? normalizeYear(yearMatch[1]) : null;
  const withoutYear = yearMatch ? nameLong.replace(yearMatch[0], '').trim() : nameLong.trim();

  let model = withoutYear;
  if (make) {
    const makePrefix = `${make} `;
    if (model.toLowerCase().startsWith(makePrefix.toLowerCase())) {
      model = model.slice(makePrefix.length).trim();
    } else if (model.toLowerCase() === make.toLowerCase()) {
      model = model.trim();
    }
  }

  if (!model) model = null;
  const needsReview = !year || !model;

  return {
    model,
    year,
    needsReview
  };
}

function buildManifest(carIds, bundleUrl, carsById, tunersById, resolvedViewAssetsByCarId, metadataSourceUrls) {
  const assets = carIds.map((id) => {
    const record = carsById[`car${id}`];
    const make = record?.manufacturerId ? tunersById[record.manufacturerId]?.name ?? null : null;
    const title = record?.nameLong ?? `GT7 Car ${id}`;
    const parsed = parseModelAndYear(record?.nameLong ?? null, make);
    const thumbnailSourceUrl = `${GT7_HOST}${THUMBNAIL_BASE_PATH}/car${id}.png`;
    const viewAssets = resolvedViewAssetsByCarId.get(id) ?? [];
    const galleryUrls = Object.fromEntries(
      viewAssets.map((viewAsset) => [
        `${viewAsset.view}_${String(viewAsset.angle).padStart(2, '0')}`,
        viewAsset.sourceUrl
      ])
    );
    const detailSourceUrl = selectDetailSourceUrl(galleryUrls, thumbnailSourceUrl);
    const tags = ['gt7', 'thumbnail', 'hotlinked'];

    if (!make || parsed.needsReview) {
      tags.push('needs-curation');
    }
    tags.push('needs-color-curation');

    return {
      externalId: id,
      sourceUrl: thumbnailSourceUrl,
      detailSourceUrl,
      galleryUrls,
      title,
      make,
      model: parsed.model,
      year: parsed.year,
      color: 'Unknown',
      delivery: 'remote-hotlink',
      tags,
      metadata: {
        gt7CarId: record?.id ?? `car${id}`,
        manufacturerId: record?.manufacturerId ?? null,
        countryId: record?.countryId ?? null,
        driveTrain: record?.driveTrain ?? null,
        nameShort: record?.nameShort ?? null
      }
    };
  });

  return {
    manifestVersion: 2,
    generatedAt: new Date().toISOString(),
    deliveryMode: 'manifest-only-remote',
    usage: {
      imageUrlField: 'sourceUrl',
      detailImageUrlField: 'detailSourceUrl',
      localMirrorRequired: false
    },
    source: {
      key: 'gt7-official-carlist',
      name: 'Gran Turismo 7 Car List',
      pageUrl: GT7_CARLIST_URL,
      bundleUrl,
      carsDataUrl: metadataSourceUrls.carsDataUrl,
      tunersDataUrl: metadataSourceUrls.tunersDataUrl
    },
    notes: [
      'externalId maps to GT7 car thumbnail key (e.g. car1932.png => externalId 1932).',
      'make/model/year are inferred from GT7 metadata and may require manual review for edge cases.',
      'color is not provided by GT7 metadata and defaults to "Unknown" for curation.',
      'detailSourceUrl prefers full-size GT carlist asset views (2_01, 3_01, then 1_01).',
      'galleryUrls includes all discovered GT car asset view URLs keyed as "<view>_<angle>".',
      'This manifest is designed for direct remote GT CDN URL usage (no local asset download).'
    ],
    stats: {
      totalAssets: assets.length,
      withGalleryCount: assets.filter((asset) => Object.keys(asset.galleryUrls).length > 0).length,
      withDetailImageCount: assets.filter((asset) => asset.detailSourceUrl !== asset.sourceUrl).length,
      missingMakeCount: assets.filter((asset) => !asset.make).length,
      needsCurationCount: assets.filter((asset) => asset.tags.includes('needs-curation')).length
    },
    assets
  };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputArg = process.argv[2] ?? DEFAULT_OUTPUT;
  const outputPath = path.resolve(scriptDir, outputArg);
  const outputDir = path.dirname(outputPath);

  console.log(`Fetching ${GT7_CARLIST_URL}`);
  const html = await fetchText(GT7_CARLIST_URL);
  const bundleUrl = extractBundleUrl(html);

  console.log(`Fetching JS bundle ${bundleUrl}`);
  const bundleSource = await fetchText(bundleUrl);
  const carIds = extractCarIds(bundleSource);
  const viewAssetsByCarId = extractCarViewAssets(bundleSource);
  console.log('Resolving hashed GT7 asset URLs from chunk exports');
  const resolvedViewAssetsByCarId = await resolveCarViewAssets(bundleUrl, viewAssetsByCarId);

  const carsChunkPath = extractChunkPath(bundleSource, '../generated-assets/data/catalog/cars.us.ts');
  const tunersChunkPath = extractChunkPath(bundleSource, '../generated-assets/data/catalog/tuners.us.ts');
  const carsDataUrl = toAbsoluteChunkUrl(bundleUrl, carsChunkPath);
  const tunersDataUrl = toAbsoluteChunkUrl(bundleUrl, tunersChunkPath);

  console.log(`Fetching cars metadata ${carsDataUrl}`);
  const carsChunkSource = await fetchText(carsDataUrl);
  const carsById = parseExportedObject(carsChunkSource);

  console.log(`Fetching tuners metadata ${tunersDataUrl}`);
  const tunersChunkSource = await fetchText(tunersDataUrl);
  const tunersById = parseExportedObject(tunersChunkSource);

  const manifest = buildManifest(carIds, bundleUrl, carsById, tunersById, resolvedViewAssetsByCarId, {
    carsDataUrl,
    tunersDataUrl
  });
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${manifest.assets.length} manifest entries to ${outputPath}`);
  console.log(`Example: ${manifest.assets[0].sourceUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
