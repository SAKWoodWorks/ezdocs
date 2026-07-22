export interface SignatureZone {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface Meta {
  createdAt: string
  expiresAt: string
  originalName: string
  signed: boolean
  signatureZone: SignatureZone | null
}
