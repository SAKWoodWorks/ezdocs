export interface SignatureZone {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface StampZone {
  page: number
  x: number
  y: number
  width: number
  height: number
  stampId: string
}

export interface Meta {
  createdAt: string
  expiresAt: string
  originalName: string
  signed: boolean
  signatureZones: SignatureZone[]
  stampZones?: StampZone[]
}
