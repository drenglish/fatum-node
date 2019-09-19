import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const axios = require('axios')
import { randomBytes } from 'crypto'

let rands = []

async function guaranteeBuffer () {
  if (rands.length < 300) {
    try {
      const qrnd = await axios.get('http://qrng.anu.edu.au/API/jsonI.php', {
        params: {
          length: 1024,
          type: 'uint8'
        },
        timeout: 1
      })
      rands = rands.concat(qrnd.data.data)
      console.log(`fetch complete`)
    } catch (e) {
      console.log(e.code) //TODO: pseudorand fallback for dev only
      rands = rands.concat(Array.from(randomBytes(1024).values()))
      console.log(`pseudorand complete`)
    }
  }
}

const byteIterator = (async function* () {
  while (true) {
    await guaranteeBuffer()
    yield rands.shift()
  }
})()
const Uint8Iterator = (async function* () {
  const buf = new ArrayBuffer(2)
  const view = new DataView(buf)

  while (true) {
    for (let i of [0,1]) {
      let x = await byteIterator.next()
      view.setUint8(i, x.value)
    }
    yield view.getUint16(0)
  }
})()

export async function getRand (maxVal) {
  const bitsNeeded = Math.ceil(Math.log(maxVal, 2))
  const iter = bitsNeeded <= 8 ? byteIterator : Uint8Iterator

  let test
  while (true) {
    test = await iter.next()
    if (test.value < maxVal && test.value > 0) {
      return test.value
    }
  }
}
