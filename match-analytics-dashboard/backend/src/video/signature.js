// Vérifie le contenu réel du fichier (et pas seulement son nom) à partir de ses premiers octets.
const isWebm = (h) => h.length >= 4 && h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3

const ISO_BOXES = ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip']
const isIsoMedia = (h) => h.length >= 12 && ISO_BOXES.includes(h.toString('latin1', 4, 8))

export function matchesSignature(head, mimeType) {
  return mimeType === 'video/webm' ? isWebm(head) : isIsoMedia(head)
}
