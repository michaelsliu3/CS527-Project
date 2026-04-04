export type Auction3dModelKey = 'su7' | 'praga' | 'mazzanti'

export function resolveAuction3dModelKey(searchableText: string): Auction3dModelKey | null {
  if (/(mazzanti|evantra)/i.test(searchableText)) return 'mazzanti'
  if (/praga/i.test(searchableText)) return 'praga'
  if (/su7/i.test(searchableText)) return 'su7'
  return null
}

export function hasAuction3dModel(searchableText: string): boolean {
  return resolveAuction3dModelKey(searchableText) !== null
}
