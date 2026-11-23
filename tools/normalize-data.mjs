import { projectEtrs89Utm29, projectedRegionBounds } from './projection.mjs';

const PEDESTRIAN_HIGHWAYS = new Set(['footway', 'pedestrian', 'steps', 'ladder', 'path', 'bridleway']);
const POI_KEYS = ['place', 'shop', 'craft', 'office', 'amenity', 'tourism', 'leisure'];
const AMENITY_TYPES = new Set(['restaurant', 'cafe', 'bar', 'pub', 'nightclub', 'bank', 'fuel', 'pharmacy', 'hospital', 'school', 'university', 'police', 'fire_station', 'place_of_worship', 'toilets', 'bench', 'shelter', 'waste_basket', 'parking']);
const NONCOMMERCIAL_AMENITIES = new Set(['hospital', 'school', 'university', 'police', 'fire_station', 'place_of_worship', 'toilets', 'bench', 'shelter', 'waste_basket', 'parking']);
const PROP_TAGS = ['natural', 'amenity', 'highway'];
const NODATA = -32768;
const HISTORIC_BUILDING_TYPES = new Set(['cathedral', 'chapel', 'church', 'castle', 'manor', 'monastery', 'palace', 'tower', 'ruins']);

export function resolveRegion(region) {
  const bounds = projectedRegionBounds(region.origin, region.extentMeters);
  return {
    ...bounds,
    minX: -region.extentMeters / 2,
    maxX: region.extentMeters / 2,
    minZ: -region.extentMeters / 2,
    maxZ: region.extentMeters / 2,
    originLon: region.origin.lon,
    originLat: region.origin.lat,
    extentMeters: region.extentMeters,
    chunkMeters: region.chunkMeters,
  };
}

function projectPoint(point, region) {
  const coordinate = projectEtrs89Utm29(point.lon, point.lat);
  return [coordinate.easting - region.origin.easting, coordinate.northing - region.origin.northing];
}

function featureBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]),
    minZ: Math.min(bounds.minZ, point[1]),
    maxX: Math.max(bounds.maxX, point[0]),
    maxZ: Math.max(bounds.maxZ, point[1]),
  }), { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity });
}

function visualBuildingFloors(tags, zone) {
  const explicitLevels = Number.parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(explicitLevels) && explicitLevels > 0) return Math.min(40, Math.max(1, explicitLevels));
  const explicitHeight = Number.parseFloat(String(tags.height ?? '').replace(',', '.'));
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) return Math.min(40, Math.max(1, explicitHeight / 3));
  const type = tags.building ?? '';
  if (type === 'tower' || /^torre(?:\s|$)/i.test(tags.name ?? '')) return 7;
  if (['cathedral', 'church', 'chapel', 'tower', 'castle'].includes(type)) return type === 'tower' || type === 'castle' ? 7 : 5;
  if (zone === 'casco') return 2;
  if (zone === 'periferia') {
    if (['apartments', 'residential'].includes(type)) return 5;
    if (['industrial', 'warehouse', 'garages', 'farm'].includes(type)) return 1;
    return 2;
  }
  if (['apartments', 'residential'].includes(type)) return 4;
  if (['industrial', 'warehouse', 'garages'].includes(type)) return 2;
  return 3;
}

function buildingZone(tags, points) {
  if (tags.historic || HISTORIC_BUILDING_TYPES.has(tags.building ?? '')) return 'casco';
  const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
  const distance = Math.hypot(center[0], center[1]);
  if (distance <= 220) return 'casco';
  if (distance <= 500) return 'ensanche';
  return 'periferia';
}

function classifyPoi(tags) {
  if (tags.historic) return { key: 'historic', value: tags.historic };
  if (tags.memorial) return { key: 'historic', value: 'memorial' };
  for (const key of POI_KEYS) {
    if (tags[key] && tags[key] !== 'no') return { key, value: tags[key] };
  }
  return undefined;
}

function isCommercial(tags) {
  if ((tags.historic || tags.memorial) && !tags.shop && !tags.brand && !tags.operator) return false;
  if (tags.amenity && NONCOMMERCIAL_AMENITIES.has(tags.amenity) && !tags.brand && !tags.operator) return false;
  if (tags.tourism === 'museum' && !tags.brand && !tags.operator) return false;
  return Boolean(tags.brand || tags.operator || tags.shop || tags.craft || tags.office)
    || (tags.amenity && AMENITY_TYPES.has(tags.amenity) && !['hospital', 'school', 'university', 'police', 'fire_station', 'place_of_worship'].includes(tags.amenity))
    || (tags.tourism && !['artwork', 'information'].includes(tags.tourism));
}

function fakeBusinessName(category, id) {
  const number = Math.abs(id) % 97 + 1;
  if (category.key === 'shop' && ['supermarket', 'convenience'].includes(category.value)) return 'MercaRoba';
  if (category.key === 'amenity' && category.value === 'nightclub') return 'Tigrus';
  if (category.key === 'amenity' && ['bar', 'pub'].includes(category.value)) return `El Farol ${String(number).padStart(2, '0')}`;
  if (category.key === 'amenity' && ['restaurant', 'cafe'].includes(category.value)) return `Mesón de la Estrella ${String(number).padStart(2, '0')}`;
  if (category.key === 'tourism' && category.value === 'hotel') return `Posada del Arco ${String(number).padStart(2, '0')}`;
  if (category.key === 'shop') return `Tienda de la Plaza ${String(number).padStart(2, '0')}`;
  return `Local de la Ciudad ${String(number).padStart(2, '0')}`;
}

function blocklistedName(tags, blocklist) {
  const candidate = [tags.brand, tags.operator, tags.name].filter(Boolean).map((value) => value.toLocaleLowerCase('es'));
  return blocklist.brands.find((brand) => brand.aliases.some((alias) => candidate.includes(alias.toLocaleLowerCase('es'))));
}

function appendPoi(element, tags, point, bounds, region, blocklist, brandReport, pois) {
  const category = classifyPoi(tags);
  if (!category) return;
  const business = isCommercial(tags);
  const mappedBrand = business ? blocklistedName(tags, blocklist) : undefined;
  const hasSourceName = Boolean(tags.name || tags.brand || tags.operator);
  const prefix = element.type === 'node' ? 'n' : element.type === 'relation' ? 'r' : 'w';
  const id = `${prefix}${element.id}`;
  const name = business ? mappedBrand?.gameName ?? fakeBusinessName(category, element.id) : tags.name ?? '';
  if (business) brandReport.push({
    id,
    category: `${category.key}:${category.value}`,
    gameName: name,
    status: mappedBrand ? 'mapped' : hasSourceName ? 'pending-review' : 'generated',
  });
  const [x, z] = projectPoint(point, region);
  pois.push({ id, category: `${category.key}:${category.value}`, name, featureType: 'poi', fictional: business, position: [x, z], bounds });
}

function relationCenter(element) {
  const points = (element.members ?? []).filter((member) => member.type === 'way' && member.role !== 'inner' && Array.isArray(member.geometry)).flatMap((member) => member.geometry);
  if (points.length === 0) return undefined;
  return points.reduce((center, point) => ({ lon: center.lon + point.lon / points.length, lat: center.lat + point.lat / points.length }), { lon: 0, lat: 0 });
}

export function normalizeOsm(osm, regionDefinition, brandBlocklist, elevation, landmarkModelIds = new Set()) {
  const region = resolveRegion(regionDefinition);
  const roads = [];
  const buildings = [];
  const surfaces = [];
  const props = [];
  const pois = [];
  const brandReport = [];
  for (const element of osm.elements) {
    const tags = element.tags ?? {};
    if (element.type === 'way' && Array.isArray(element.geometry)) {
      const points = element.geometry.map((point) => projectPoint(point, region));
      const bounds = featureBounds(points);
      if (tags.highway) {
        const rawOneWay = tags.oneway ?? 'no';
        const oneWay = ['yes', '1', 'true'].includes(rawOneWay) ? 1 : rawOneWay === '-1' ? -1 : 0;
        const record = {
          id: `w${element.id}`,
          featureType: PEDESTRIAN_HIGHWAYS.has(tags.highway) ? 'pedestrian' : 'road',
          kind: PEDESTRIAN_HIGHWAYS.has(tags.highway) ? 'pedestrian' : 'road',
          highway: tags.highway,
          nodeIds: Array.isArray(element.nodes) ? element.nodes : [],
          name: tags.name ?? '',
          lanes: Number.parseInt(tags.lanes ?? '', 10) || null,
          maxSpeedKph: Number.parseFloat(tags.maxspeed ?? '') || null,
          widthMeters: Number.parseFloat(String(tags.width ?? '').replace(',', '.')) || null,
          oneway: oneWay,
          sidewalk: tags.sidewalk ?? 'unknown',
          sidewalkLeft: tags['sidewalk:left'] ?? 'unknown',
          sidewalkRight: tags['sidewalk:right'] ?? 'unknown',
          turnLanes: tags['turn:lanes'] ?? '',
          surface: tags.surface ?? 'unknown',
          bridge: Boolean(tags.bridge && tags.bridge !== 'no'),
          tunnel: Boolean(tags.tunnel && tags.tunnel !== 'no'),
          layer: Number.parseInt(tags.layer ?? '0', 10) || 0,
          incline: tags.incline ?? '',
          junction: tags.junction ?? '',
          area: tags.area === 'yes',
          points,
          bounds,
        };
        roads.push(record);
      } else if (tags.building && tags.building !== 'no') {
        const zone = buildingZone(tags, points);
        const floors = Number.parseFloat(tags['building:levels'] ?? '') || null;
        const heightMeters = Number.parseFloat(String(tags.height ?? '').replace(',', '.')) || null;
        const visualFloors = visualBuildingFloors(tags, zone);
        const commercial = isCommercial(tags);
        const poiCategory = classifyPoi(tags);
        const mappedBrand = commercial ? blocklistedName(tags, brandBlocklist) : undefined;
        const commercialName = commercial ? (mappedBrand?.gameName ?? fakeBusinessName(poiCategory ?? { key: 'business', value: tags.building }, element.id)) : '';
        buildings.push({
          id: `w${element.id}`,
          featureType: 'building',
          ...(commercial && commercialName ? { name: commercialName } : {}),
          ...(!commercial && tags.name ? { name: tags.name } : {}),
          floors,
          heightMeters,
          visualFloors,
          visualHeightMeters: heightMeters ?? visualFloors * 3,
          roofHeightMeters: Number.parseFloat(String(tags['roof:height'] ?? '').replace(',', '.')) || null,
          roofShape: tags['roof:shape'] ?? 'unknown',
          roofMaterial: zone === 'casco' ? 'tile' : 'modern',
          roofColour: tags['roof:colour'] ?? '',
          facadeColour: tags['building:colour'] ?? '',
          buildingType: tags.building,
          historic: tags.historic ?? '',
          zone,
          commercial,
          commercialCategory: commercial ? `${poiCategory?.key ?? 'business'}:${poiCategory?.value ?? tags.building}` : '',
          landmarkModelPath: landmarkModelIds.has(`w${element.id}`) ? `landmarks/w${element.id}.glb` : '',
          points,
          bounds,
        });
      } else if (tags.barrier === 'city_wall') {
        surfaces.push({
          id: `w${element.id}`,
          featureType: 'surface',
          name: tags.name ?? '',
          kind: 'historic_wall',
          value: 'city_wall',
          points,
          bounds,
        });
      } else if (tags.place === 'square' || tags.landuse || tags.natural || tags.waterway || tags.leisure) {
        const isSquare = tags.place === 'square';
        surfaces.push({
          id: `w${element.id}`,
          featureType: 'surface',
          name: tags.name ?? '',
          kind: isSquare ? 'square' : tags.waterway ? 'waterway' : tags.natural === 'water' ? 'water' : tags.leisure ? 'leisure' : tags.landuse ? 'landuse' : 'natural',
          value: isSquare ? 'square' : tags.waterway ?? tags.natural ?? tags.leisure ?? tags.landuse,
          surface: tags.surface ?? '',
          points,
          bounds,
        });
      }
      if (points.length > 0 && classifyPoi(tags)) {
        const center = element.geometry.reduce((sum, point) => ({
          lon: sum.lon + point.lon / points.length,
          lat: sum.lat + point.lat / points.length,
        }), { lon: 0, lat: 0 });
        appendPoi(element, tags, center, bounds, region, brandBlocklist, brandReport, pois);
      }
    }
    if (element.type === 'node' && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
      const propTag = PROP_TAGS.find((key) => tags[key] && (key !== 'natural' || tags[key] === 'tree'));
      if ((propTag && (tags.natural === 'tree' || ['bench', 'shelter', 'waste_basket'].includes(tags.amenity) || ['street_lamp', 'traffic_signals', 'crossing', 'stop', 'give_way'].includes(tags.highway))) || tags.traffic_sign) {
        const point = projectPoint(element, region);
        props.push({
          id: `n${element.id}`,
          featureType: 'prop',
          kind: tags.natural === 'tree' ? 'tree' : tags.amenity ?? tags.highway ?? 'traffic_sign',
          position: point,
          directionDegrees: Number.parseFloat(tags.direction ?? '') || null,
          trafficSign: tags.traffic_sign ?? '',
        });
        continue;
      }
      appendPoi(element, tags, element, undefined, region, brandBlocklist, brandReport, pois);
    }
    if (element.type === 'relation' && classifyPoi(tags)) {
      const center = relationCenter(element);
      if (center) appendPoi(element, tags, center, undefined, region, brandBlocklist, brandReport, pois);
    }
  }

  const features = [...roads, ...buildings, ...surfaces, ...props, ...pois];
  const buildingZoneCounts = Object.fromEntries(['casco', 'ensanche', 'periferia'].map((zone) => [zone, buildings.filter((building) => building.zone === zone).length]));
  region.gridSamples = regionDefinition.heightGrid.samples;
  const chunks = chunkFeatures(features, regionDefinition.chunkMeters, elevation, region);
  const issues = {
    missingBuildingHeights: buildings.filter((building) => building.heightMeters === null && building.floors === null).length,
    pendingBrands: brandReport.filter((brand) => brand.status === 'pending-review').length,
    missingTerrainSamples: chunks.reduce((sum, chunk) => sum + chunk.missingTerrainSamples, 0),
  };
  return { region, roads, buildings, buildingZoneCounts, surfaces, props, pois, chunks, brandReport, issues };
}

function chunkFeatures(features, chunkMeters, elevation, region) {
  const minChunk = Math.floor(region.minX / chunkMeters);
  const maxChunk = Math.floor((region.maxX - 0.001) / chunkMeters);
  const minRow = Math.floor(region.minZ / chunkMeters);
  const maxRow = Math.floor((region.maxZ - 0.001) / chunkMeters);
  const chunks = [];
  for (let zIndex = minRow; zIndex <= maxRow; zIndex += 1) {
    for (let xIndex = minChunk; xIndex <= maxChunk; xIndex += 1) {
      const x = xIndex * chunkMeters;
      const z = zIndex * chunkMeters;
      const bounds = { minX: x, minZ: z, maxX: x + chunkMeters, maxZ: z + chunkMeters };
      const localFeatures = features.filter((feature) => feature.bounds
        ? feature.bounds.maxX >= bounds.minX && feature.bounds.minX <= bounds.maxX && feature.bounds.maxZ >= bounds.minZ && feature.bounds.minZ <= bounds.maxZ
        : feature.position[0] >= bounds.minX && feature.position[0] <= bounds.maxX && feature.position[1] >= bounds.minZ && feature.position[1] <= bounds.maxZ);
      const { heights, missingTerrainSamples } = sampleHeightGrid(elevation, bounds, region);
      chunks.push({
        id: `${xIndex}_${zIndex}`,
        xIndex,
        zIndex,
        bounds,
        terrain: { samples: region.gridSamples, stepMeters: chunkMeters / (region.gridSamples - 1), quantizationMeters: 0.25, heights },
        features: localFeatures,
        missingTerrainSamples,
      });
    }
  }
  return chunks;
}

function sampleHeightGrid(elevation, bounds, region) {
  const samples = region.gridSamples;
  const heights = new Int16Array(samples * samples);
  let missingTerrainSamples = 0;
  for (let row = 0; row < samples; row += 1) {
    const z = bounds.minZ + row * region.chunkMeters / (samples - 1);
    for (let column = 0; column < samples; column += 1) {
      const x = bounds.minX + column * region.chunkMeters / (samples - 1);
      const height = elevation.sample(x, z);
      const index = row * samples + column;
      if (height === null) {
        heights[index] = NODATA;
        missingTerrainSamples += 1;
      } else {
        heights[index] = Math.round(height / 0.25);
      }
    }
  }
  return { heights: Array.from(heights), missingTerrainSamples };
}

