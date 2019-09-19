import { getAttractor, getVoid } from './core/geo.mjs'

const hb = {lat: 41.982937, lon: -87.906416}
getAttractor(hb, 3000)
  .catch(e => console.error(e))
  .then(v => console.log(v))

getVoid(hb, 3000)
  .catch(e => console.error(e))
  .then(v => console.log(v))
