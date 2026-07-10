import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const BYTES_PER_PIXEL = 4
const MAX_PIXELS = 16_777_216

function paethPredictor(left, up, upperLeft) {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  if (upDistance <= upperLeftDistance) return up
  return upperLeft
}

function unfilterScanlines(inflated, width, height) {
  const stride = width * BYTES_PER_PIXEL
  const expectedLength = height * (stride + 1)
  if (inflated.length !== expectedLength) {
    throw new Error(`Unexpected PNG payload length: ${inflated.length}, expected ${expectedLength}`)
  }

  const rgba = Buffer.alloc(width * height * BYTES_PER_PIXEL)
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)]
    if (filter > 4) throw new Error(`Unsupported PNG filter type: ${filter}`)

    const sourceStart = y * (stride + 1) + 1
    const rowStart = y * stride
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceStart + x]
      const left = x >= BYTES_PER_PIXEL ? rgba[rowStart + x - BYTES_PER_PIXEL] : 0
      const up = y > 0 ? rgba[rowStart + x - stride] : 0
      const upperLeft = y > 0 && x >= BYTES_PER_PIXEL
        ? rgba[rowStart + x - stride - BYTES_PER_PIXEL]
        : 0

      let reconstructed = raw
      if (filter === 1) reconstructed += left
      if (filter === 2) reconstructed += up
      if (filter === 3) reconstructed += Math.floor((left + up) / 2)
      if (filter === 4) reconstructed += paethPredictor(left, up, upperLeft)
      rgba[rowStart + x] = reconstructed & 0xff
    }
  }
  return rgba
}

export function decodePngRgba(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature')
  }

  let offset = 8
  let header
  let reachedEnd = false
  const compressedParts = []

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error('Truncated PNG chunk header')
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const chunkEnd = dataEnd + 4
    if (dataEnd < dataStart || chunkEnd > buffer.length) throw new Error(`Truncated PNG ${type} chunk`)

    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('Invalid PNG IHDR chunk')
      header = {
        width: buffer.readUInt32BE(dataStart),
        height: buffer.readUInt32BE(dataStart + 4),
        bitDepth: buffer[dataStart + 8],
        colorType: buffer[dataStart + 9],
        compression: buffer[dataStart + 10],
        filter: buffer[dataStart + 11],
        interlace: buffer[dataStart + 12],
      }
    } else if (type === 'IDAT') {
      compressedParts.push(buffer.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      reachedEnd = true
      break
    }

    offset = chunkEnd
  }

  if (!header || !reachedEnd || compressedParts.length === 0) throw new Error('PNG is missing required chunks')
  if (header.width <= 0 || header.height <= 0 || header.width * header.height > MAX_PIXELS) {
    throw new Error(`PNG dimensions exceed safe limits: ${header.width}x${header.height}`)
  }
  if (
    header.bitDepth !== 8
    || header.colorType !== 6
    || header.compression !== 0
    || header.filter !== 0
    || header.interlace !== 0
  ) {
    throw new Error('Only non-interlaced 8-bit RGBA PNG files are supported')
  }

  const expectedLength = header.height * (header.width * BYTES_PER_PIXEL + 1)
  const inflated = inflateSync(Buffer.concat(compressedParts), { maxOutputLength: expectedLength + 1 })
  return {
    width: header.width,
    height: header.height,
    data: unfilterScanlines(inflated, header.width, header.height),
  }
}

export function readPngRgba(path) {
  return decodePngRgba(readFileSync(path))
}
