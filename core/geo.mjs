import { getRand } from './qrnd.mjs'

const EARTH_RADIUS = 6371000
const RADN = EARTH_RADIUS * Math.PI/180
const MIN_P = 100
const MIN_P_RADIUS = 50

function getDistance ( center, target ) {
  const {lat: lat0, lon: lon0} = center
  const {lat: lat1, lon: lon1} = target
  const dLon = (lon1 - lon0) * Math.PI/180,
        dLat = (lat1 - lat0) * Math.PI/180
  const a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) + Math.cos(lat0 * Math.PI/180) * Math.cos(lat1 * Math.PI/180) * (Math.sin(dLon/2) * Math.sin(dLon/2))
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS)|0
}

function getAzimuth ( center, target ) {
  const {lat: lat0, lon: lon0} = center
  const {lat: lat1, lon: lon1} = target
  const dLon = (lon1 - lon0) * RADN,
        dLat = (lat1 - lat0) * RADN

  let az = (180 * Math.atan( (dLon * Math.cos(lat0 * Math.PI/180)) / dLat )) / Math.PI
  az = az < 0 ? az + 360 : az

  const rd = getDistance(center, target)
  const rd1 = getDistance(target, {
    lat: center.lat + rd * Math.cos(az * Math.PI/180) / RADN,
    lon: center.lon + rd * Math.sin(az * Math.PI/180) / Math.cos(center.lat * Math.PI/180) / RADN
  })

  return rd < rd1 ? az + 180 : az
}

function getAverageCoordinate ( pointsBag ) {
  const avg = pointsBag
    .reduce( (a, coord) => {
      const [lat, lon] = coord.split(':')
      return { lat: a.lat + Number(lat), lon: a.lon + Number(lon) }
    }, {lat: 0, lon: 0})
  return {
    lat: avg.lat/pointsBag.length,
    lon: avg.lon/pointsBag.length
  }
}

function getMirrorCoordinate ( center, target ) {
  const distance = getDistance(center, target)
  let az = getAzimuth(center, target)
  az = az < 180 ? az + 180 : az - 180
  return {
    lat: center.lat + distance * Math.cos(az * Math.PI/180) / RADN,
    lon: center.lon + distance * Math.sin(az * Math.PI/180) / Math.cos(center.lat * Math.PI/180) / RADN
  }
}

async function fillPointsBag ( center, radius ) {
  const bag = new Set()
  let size = Math.round(radius/10)
  size = size < MIN_P ? MIN_P : size
  const it = takeCoordinate(center, radius)

  while (bag.size < size) {
    const coord = await it.next()
    const { lat: plat, lon: plon } = coord.value
    bag.add(`${plat}:${plon}`)
  }
  return Array.from(bag)
}

function getStats (attractor, pointsBag, radius) {
  const distances = pointsBag
    .map( coord => {
      const [plat, plon] = coord.split(':')
      return getDistance(attractor, {lat: Number(plat), lon: Number(plon)})
    } )
  const sorted = distances
    .slice(0, distances.length)
    .sort( (a, b) => a - b)

  const minrad = sorted[0]
  let testpts = [], testrad = 2 * minrad
  while (testpts.length < 10) {
    testpts = distances
      .filter( d => d <= testrad)
    testrad += minrad // expand the test radius till we nab at least 10 random points
  }

  // average radius of selected points
  const arad = testpts
    .reduce( (a, d) => a + d, 0) / testpts.length
  // number of points in full set within radius
  const nrad = sorted
    .filter( d => d <= arad)
    .length
  const power = (nrad * Math.pow(radius, 2)) / (pointsBag.length * Math.pow(arad, 2))
  console.log(`(${nrad} * Math.pow(${radius}, 2)) / (${pointsBag.length} * Math.pow(${arad}, 2))`)

  return { coordinate: {lat: attractor.lat, lon: attractor.lon}, radius: Math.round(arad), power }
}

export async function getAttractor ( center, radius ) {
  const fullBag = await fillPointsBag(center, radius)
  let avgCoord,
      rd = radius,
      bag = Array.from(fullBag)

  console.log('get attractor')
  // Step the test radius down 1 meter per iteration
  while (--rd > MIN_P_RADIUS && bag.length > 1) {
    avgCoord = getAverageCoordinate(bag)
    bag = bag.filter(v => {
        const [plat, plon] = v.split(':')
        return getDistance(avgCoord, {lat: Number(plat), lon: Number(plon)}) <= rd
      })
  }
  return getStats(avgCoord, fullBag, radius)
}

export async function getVoid ( center, radius ) {
  const fullBag = await fillPointsBag(center, radius)
  let mirCoord,
      rd = radius,
      bag = Array.from(fullBag)

  console.log('get void')
  while (--rd > MIN_P_RADIUS && bag.length > 1) {
    mirCoord = getMirrorCoordinate(center, getAverageCoordinate(bag))
    rd = rd - getDistance(mirCoord, center)

    bag = bag.filter(v => {
      const [plat, plon] = v.split(':')
      return getDistance(mirCoord, {lat: Number(plat), lon: Number(plon)}) <= rd
    })

    center = mirCoord // reset "center" for next iteration
  }
  const stats = getStats(mirCoord, fullBag, radius)
  return { ...stats, ...{ power: 1 / stats.power } }
}

export async function* takeCoordinate ( { lat, lon }, radius ) {
  const latBase = lat + radius * -1 / RADN
  const dLat = ((lat + radius / RADN) - latBase) * 1000000
  const lonBase = lon + radius * Math.sin(270 * Math.PI/180) / Math.cos(lat * Math.PI/180) / RADN
  const dLon = ((lon + radius * Math.sin(90 * Math.PI/180) / Math.cos(lat * Math.PI/180) / RADN) - lonBase) * 1000000

  while (true) {
    let rLat = await getRand(dLat)
    let rLon = await getRand(dLon)
    rLat = latBase + rLat/1000000
    rLon = lonBase + rLon/1000000
    if (getDistance({lat, lon}, {lat: rLat, lon: rLon}) <= radius) {
      yield {lat: rLat, lon: rLon}
    }
  }
}
