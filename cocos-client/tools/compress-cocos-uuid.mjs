const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function compressCocosUuid(uuid) {
  const hex = uuid.replaceAll('-', '')
  if (!/^[\da-f]{32}$/i.test(hex)) throw new Error(`Invalid UUID: ${uuid}`)

  const bits = hex.slice(5).split('').map((char) => Number.parseInt(char, 16).toString(2).padStart(4, '0')).join('')
  let output = hex.slice(0, 5)
  for (let offset = 0; offset < bits.length; offset += 6) {
    output += BASE64[Number.parseInt(bits.slice(offset, offset + 6).padEnd(6, '0'), 2)]
  }
  return output
}
