export interface Slip2GoResponse {
  code: string
  message: string
  data: {
    referenceId: string
    decode: string
    transRef: string
    dateTime: string
    amount: number
    ref1: string | null
    ref2: string | null
    ref3: string | null
    receiver: {
      account: {
        name: string
        bank: {
          account: string
        }
        proxy?: {
          type: string
          account: string
        }
      }
      bank: {
        id: string
        name: string
      }
    }
    sender: {
      account: {
        name: string
        bank: {
          account: string
        }
      }
      bank: {
        id: string
        name: string
      }
    }
  }
}
