// Code generated — DO NOT EDIT.
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeEventTopics,
  encodeFunctionData,
  zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
  bytesToHex,
  encodeCallMsg,
  EVMClient,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type EVMLog,
  type Runtime,
} from '@chainlink/cre-sdk'

export interface DecodedLog<T> extends Omit<EVMLog, 'data'> { data: T }

const encodeTopicValue = (t: Hex | Hex[] | null): string[] => {
  if (t == null) return []
  if (Array.isArray(t)) return t.map(hexToBase64)
  return [hexToBase64(t)]
}





/**
 * Filter params for ControllerChangeCancelled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ControllerChangeCancelledTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded ControllerChangeCancelled event data.
 */
export type ControllerChangeCancelledDecoded = {
  domainHash: `0x${string}`
}


/**
 * Filter params for ControllerChangeQueued. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ControllerChangeQueuedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded ControllerChangeQueued event data.
 */
export type ControllerChangeQueuedDecoded = {
  domainHash: `0x${string}`
  newController: `0x${string}`
  eta: bigint
}


/**
 * Filter params for ControllerChanged. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ControllerChangedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded ControllerChanged event data.
 */
export type ControllerChangedDecoded = {
  domainHash: `0x${string}`
  newController: `0x${string}`
}


/**
 * Filter params for PayeeFrozen. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type PayeeFrozenTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded PayeeFrozen event data.
 */
export type PayeeFrozenDecoded = {
  domainHash: `0x${string}`
  payout: `0x${string}`
}


/**
 * Filter params for PayeeVerified. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type PayeeVerifiedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded PayeeVerified event data.
 */
export type PayeeVerifiedDecoded = {
  domainHash: `0x${string}`
  controller: `0x${string}`
  payout: `0x${string}`
  leiHash: `0x${string}`
}


/**
 * Filter params for PayoutChangeCancelled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type PayoutChangeCancelledTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded PayoutChangeCancelled event data.
 */
export type PayoutChangeCancelledDecoded = {
  domainHash: `0x${string}`
  by: `0x${string}`
}


/**
 * Filter params for PayoutChangeQueued. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type PayoutChangeQueuedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded PayoutChangeQueued event data.
 */
export type PayoutChangeQueuedDecoded = {
  domainHash: `0x${string}`
  newPayout: `0x${string}`
  eta: bigint
}


/**
 * Filter params for PayoutChanged. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type PayoutChangedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded PayoutChanged event data.
 */
export type PayoutChangedDecoded = {
  domainHash: `0x${string}`
  oldPayout: `0x${string}`
  newPayout: `0x${string}`
}


/**
 * Filter params for RegistrationRequested. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type RegistrationRequestedTopics = {
  domainHash?: `0x${string}`
  requester?: `0x${string}`
}

/**
 * Decoded RegistrationRequested event data.
 */
export type RegistrationRequestedDecoded = {
  domainHash: `0x${string}`
  domain: string
  requester: `0x${string}`
}


/**
 * Filter params for VerificationRejected. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type VerificationRejectedTopics = {
  domainHash?: `0x${string}`
}

/**
 * Decoded VerificationRejected event data.
 */
export type VerificationRejectedDecoded = {
  domainHash: `0x${string}`
  controller: `0x${string}`
  collidesWith: `0x${string}`
}


export const PayeeRegistryABI = [{"type":"constructor","inputs":[{"name":"_forwarder","type":"address","internalType":"address"},{"name":"_expectedAuthor","type":"address","internalType":"address"},{"name":"_approvalSigner","type":"address","internalType":"address"},{"name":"_changeDelay","type":"uint64","internalType":"uint64"}],"stateMutability":"nonpayable"},{"type":"function","name":"ACTION_FREEZE","inputs":[],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"function","name":"ACTION_VERIFY","inputs":[],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"function","name":"DOMAIN_SEPARATOR","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"PAYOUT_CHANGE_TYPEHASH","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"approvalSigner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"cancelControllerChange","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"cancelPayoutChange","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"changeDelay","inputs":[],"outputs":[{"name":"","type":"uint64","internalType":"uint64"}],"stateMutability":"view"},{"type":"function","name":"domainAt","inputs":[{"name":"i","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"domainHash","type":"bytes32","internalType":"bytes32"},{"name":"domain","type":"string","internalType":"string"},{"name":"status","type":"uint8","internalType":"enumPayeeRegistry.Status"}],"stateMutability":"view"},{"type":"function","name":"domainCount","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"executeControllerChange","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"executePayoutChange","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"expectedAuthor","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"fingerprint","inputs":[{"name":"a","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bytes4","internalType":"bytes4"}],"stateMutability":"pure"},{"type":"function","name":"fingerprintOwner","inputs":[{"name":"","type":"bytes4","internalType":"bytes4"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"forwarder","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"getPayee","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"tuple","internalType":"structPayeeRegistry.Payee","components":[{"name":"domain","type":"string","internalType":"string"},{"name":"controller","type":"address","internalType":"address"},{"name":"payout","type":"address","internalType":"address"},{"name":"leiHash","type":"bytes32","internalType":"bytes32"},{"name":"status","type":"uint8","internalType":"enumPayeeRegistry.Status"},{"name":"verifiedAt","type":"uint64","internalType":"uint64"},{"name":"pendingPayout","type":"address","internalType":"address"},{"name":"payoutEta","type":"uint64","internalType":"uint64"},{"name":"pendingController","type":"address","internalType":"address"},{"name":"controllerEta","type":"uint64","internalType":"uint64"}]}],"stateMutability":"view"},{"type":"function","name":"inspectRecipient","inputs":[{"name":"recipient","type":"address","internalType":"address"}],"outputs":[{"name":"verdict","type":"uint8","internalType":"enumPayeeRegistry.Verdict"},{"name":"domainHash","type":"bytes32","internalType":"bytes32"},{"name":"imitated","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"nonces","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"onReport","inputs":[{"name":"metadata","type":"bytes","internalType":"bytes"},{"name":"report","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"payoutToDomain","inputs":[{"name":"","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},{"type":"function","name":"requestPayoutChange","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"},{"name":"newPayout","type":"address","internalType":"address"},{"name":"deadline","type":"uint256","internalType":"uint256"},{"name":"sig","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"requestRegistration","inputs":[{"name":"domain","type":"string","internalType":"string"}],"outputs":[{"name":"domainHash","type":"bytes32","internalType":"bytes32"}],"stateMutability":"nonpayable"},{"type":"function","name":"resolve","inputs":[{"name":"d","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"payout","type":"address","internalType":"address"},{"name":"status","type":"uint8","internalType":"enumPayeeRegistry.Status"}],"stateMutability":"view"},{"type":"function","name":"resolveName","inputs":[{"name":"domain","type":"string","internalType":"string"}],"outputs":[{"name":"payout","type":"address","internalType":"address"},{"name":"status","type":"uint8","internalType":"enumPayeeRegistry.Status"}],"stateMutability":"view"},{"type":"function","name":"supportsInterface","inputs":[{"name":"interfaceId","type":"bytes4","internalType":"bytes4"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"pure"},{"type":"event","name":"ControllerChangeCancelled","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"ControllerChangeQueued","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"newController","type":"address","indexed":false,"internalType":"address"},{"name":"eta","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"ControllerChanged","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"newController","type":"address","indexed":false,"internalType":"address"}],"anonymous":false},{"type":"event","name":"PayeeFrozen","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"payout","type":"address","indexed":false,"internalType":"address"}],"anonymous":false},{"type":"event","name":"PayeeVerified","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"controller","type":"address","indexed":false,"internalType":"address"},{"name":"payout","type":"address","indexed":false,"internalType":"address"},{"name":"leiHash","type":"bytes32","indexed":false,"internalType":"bytes32"}],"anonymous":false},{"type":"event","name":"PayoutChangeCancelled","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"by","type":"address","indexed":false,"internalType":"address"}],"anonymous":false},{"type":"event","name":"PayoutChangeQueued","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"newPayout","type":"address","indexed":false,"internalType":"address"},{"name":"eta","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"PayoutChanged","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"oldPayout","type":"address","indexed":false,"internalType":"address"},{"name":"newPayout","type":"address","indexed":false,"internalType":"address"}],"anonymous":false},{"type":"event","name":"RegistrationRequested","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"domain","type":"string","indexed":false,"internalType":"string"},{"name":"requester","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"VerificationRejected","inputs":[{"name":"domainHash","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"controller","type":"address","indexed":false,"internalType":"address"},{"name":"collidesWith","type":"address","indexed":false,"internalType":"address"}],"anonymous":false},{"type":"error","name":"BadAction","inputs":[{"name":"action","type":"uint8","internalType":"uint8"}]},{"type":"error","name":"BadSignature","inputs":[]},{"type":"error","name":"Expired","inputs":[]},{"type":"error","name":"InvalidAuthor","inputs":[{"name":"received","type":"address","internalType":"address"},{"name":"expected","type":"address","internalType":"address"}]},{"type":"error","name":"InvalidDomain","inputs":[]},{"type":"error","name":"LookalikeCollision","inputs":[{"name":"existing","type":"address","internalType":"address"}]},{"type":"error","name":"NotActive","inputs":[]},{"type":"error","name":"NotAuthorized","inputs":[]},{"type":"error","name":"NotController","inputs":[]},{"type":"error","name":"NothingPending","inputs":[]},{"type":"error","name":"PayoutInUse","inputs":[{"name":"payout","type":"address","internalType":"address"}]},{"type":"error","name":"TooEarly","inputs":[{"name":"eta","type":"uint64","internalType":"uint64"}]},{"type":"error","name":"UnauthorizedForwarder","inputs":[{"name":"caller","type":"address","internalType":"address"}]},{"type":"error","name":"UnknownDomain","inputs":[{"name":"domainHash","type":"bytes32","internalType":"bytes32"}]},{"type":"error","name":"ZeroAddress","inputs":[]}] as const

export class PayeeRegistry {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  aCTIONFREEZE(
    runtime: Runtime<unknown>,
  ): number {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'ACTION_FREEZE' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'ACTION_FREEZE' as const,
      data: bytesToHex(result.data),
    }) as number
  }

  aCTIONVERIFY(
    runtime: Runtime<unknown>,
  ): number {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'ACTION_VERIFY' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'ACTION_VERIFY' as const,
      data: bytesToHex(result.data),
    }) as number
  }

  dOMAINSEPARATOR(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'DOMAIN_SEPARATOR' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'DOMAIN_SEPARATOR' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  pAYOUTCHANGETYPEHASH(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'PAYOUT_CHANGE_TYPEHASH' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'PAYOUT_CHANGE_TYPEHASH' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  approvalSigner(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'approvalSigner' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'approvalSigner' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  changeDelay(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'changeDelay' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'changeDelay' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  domainAt(
    runtime: Runtime<unknown>,
    i: bigint,
  ): readonly [`0x${string}`, string, number] {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'domainAt' as const,
      args: [i],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'domainAt' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, string, number]
  }

  domainCount(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'domainCount' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'domainCount' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  expectedAuthor(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'expectedAuthor' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'expectedAuthor' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  fingerprint(
    runtime: Runtime<unknown>,
    a: `0x${string}`,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'fingerprint' as const,
      args: [a],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'fingerprint' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  fingerprintOwner(
    runtime: Runtime<unknown>,
    arg0: `0x${string}`,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'fingerprintOwner' as const,
      args: [arg0],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'fingerprintOwner' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  forwarder(
    runtime: Runtime<unknown>,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'forwarder' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'forwarder' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  getPayee(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
  ): { domain: string; controller: `0x${string}`; payout: `0x${string}`; leiHash: `0x${string}`; status: number; verifiedAt: bigint; pendingPayout: `0x${string}`; payoutEta: bigint; pendingController: `0x${string}`; controllerEta: bigint } {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'getPayee' as const,
      args: [d],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'getPayee' as const,
      data: bytesToHex(result.data),
    }) as { domain: string; controller: `0x${string}`; payout: `0x${string}`; leiHash: `0x${string}`; status: number; verifiedAt: bigint; pendingPayout: `0x${string}`; payoutEta: bigint; pendingController: `0x${string}`; controllerEta: bigint }
  }

  inspectRecipient(
    runtime: Runtime<unknown>,
    recipient: `0x${string}`,
  ): readonly [number, `0x${string}`, `0x${string}`] {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'inspectRecipient' as const,
      args: [recipient],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'inspectRecipient' as const,
      data: bytesToHex(result.data),
    }) as readonly [number, `0x${string}`, `0x${string}`]
  }

  nonces(
    runtime: Runtime<unknown>,
    arg0: `0x${string}`,
  ): bigint {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'nonces' as const,
      args: [arg0],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'nonces' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  payoutToDomain(
    runtime: Runtime<unknown>,
    arg0: `0x${string}`,
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'payoutToDomain' as const,
      args: [arg0],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'payoutToDomain' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  resolve(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
  ): readonly [`0x${string}`, number] {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'resolve' as const,
      args: [d],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'resolve' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, number]
  }

  resolveName(
    runtime: Runtime<unknown>,
    domain: string,
  ): readonly [`0x${string}`, number] {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'resolveName' as const,
      args: [domain],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'resolveName' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, number]
  }

  supportsInterface(
    runtime: Runtime<unknown>,
    interfaceId: `0x${string}`,
  ): boolean {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'supportsInterface' as const,
      args: [interfaceId],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: PayeeRegistryABI,
      functionName: 'supportsInterface' as const,
      data: bytesToHex(result.data),
    }) as boolean
  }

  writeReportFromCancelControllerChange(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'cancelControllerChange' as const,
      args: [d],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromCancelPayoutChange(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'cancelPayoutChange' as const,
      args: [d],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromExecuteControllerChange(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'executeControllerChange' as const,
      args: [d],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromExecutePayoutChange(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'executePayoutChange' as const,
      args: [d],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromOnReport(
    runtime: Runtime<unknown>,
    metadata: `0x${string}`,
    report: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'onReport' as const,
      args: [metadata, report],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromRequestPayoutChange(
    runtime: Runtime<unknown>,
    d: `0x${string}`,
    newPayout: `0x${string}`,
    deadline: bigint,
    sig: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'requestPayoutChange' as const,
      args: [d, newPayout, deadline, sig],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromRequestRegistration(
    runtime: Runtime<unknown>,
    domain: string,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: PayeeRegistryABI,
      functionName: 'requestRegistration' as const,
      args: [domain],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReport(
    runtime: Runtime<unknown>,
    callData: Hex,
    gasConfig?: { gasLimit?: string },
  ) {
    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  /**
   * Creates a log trigger for ControllerChangeCancelled events.
   * The returned trigger's adapt method decodes the raw log into ControllerChangeCancelledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerControllerChangeCancelled(
    filters?: ControllerChangeCancelledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChangeCancelled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChangeCancelled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'ControllerChangeCancelled' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ControllerChangeCancelledDecoded> => contract.decodeControllerChangeCancelled(rawOutput),
    }
  }

  /**
   * Decodes a log into ControllerChangeCancelled data, preserving all log metadata.
   */
  decodeControllerChangeCancelled(log: EVMLog): DecodedLog<ControllerChangeCancelledDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ControllerChangeCancelledDecoded }
  }

  /**
   * Creates a log trigger for ControllerChangeQueued events.
   * The returned trigger's adapt method decodes the raw log into ControllerChangeQueuedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerControllerChangeQueued(
    filters?: ControllerChangeQueuedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChangeQueued' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChangeQueued' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'ControllerChangeQueued' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ControllerChangeQueuedDecoded> => contract.decodeControllerChangeQueued(rawOutput),
    }
  }

  /**
   * Decodes a log into ControllerChangeQueued data, preserving all log metadata.
   */
  decodeControllerChangeQueued(log: EVMLog): DecodedLog<ControllerChangeQueuedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ControllerChangeQueuedDecoded }
  }

  /**
   * Creates a log trigger for ControllerChanged events.
   * The returned trigger's adapt method decodes the raw log into ControllerChangedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerControllerChanged(
    filters?: ControllerChangedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChanged' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'ControllerChanged' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'ControllerChanged' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ControllerChangedDecoded> => contract.decodeControllerChanged(rawOutput),
    }
  }

  /**
   * Decodes a log into ControllerChanged data, preserving all log metadata.
   */
  decodeControllerChanged(log: EVMLog): DecodedLog<ControllerChangedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ControllerChangedDecoded }
  }

  /**
   * Creates a log trigger for PayeeFrozen events.
   * The returned trigger's adapt method decodes the raw log into PayeeFrozenDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerPayeeFrozen(
    filters?: PayeeFrozenTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayeeFrozen' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayeeFrozen' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'PayeeFrozen' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<PayeeFrozenDecoded> => contract.decodePayeeFrozen(rawOutput),
    }
  }

  /**
   * Decodes a log into PayeeFrozen data, preserving all log metadata.
   */
  decodePayeeFrozen(log: EVMLog): DecodedLog<PayeeFrozenDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as PayeeFrozenDecoded }
  }

  /**
   * Creates a log trigger for PayeeVerified events.
   * The returned trigger's adapt method decodes the raw log into PayeeVerifiedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerPayeeVerified(
    filters?: PayeeVerifiedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayeeVerified' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayeeVerified' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'PayeeVerified' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<PayeeVerifiedDecoded> => contract.decodePayeeVerified(rawOutput),
    }
  }

  /**
   * Decodes a log into PayeeVerified data, preserving all log metadata.
   */
  decodePayeeVerified(log: EVMLog): DecodedLog<PayeeVerifiedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as PayeeVerifiedDecoded }
  }

  /**
   * Creates a log trigger for PayoutChangeCancelled events.
   * The returned trigger's adapt method decodes the raw log into PayoutChangeCancelledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerPayoutChangeCancelled(
    filters?: PayoutChangeCancelledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChangeCancelled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChangeCancelled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'PayoutChangeCancelled' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<PayoutChangeCancelledDecoded> => contract.decodePayoutChangeCancelled(rawOutput),
    }
  }

  /**
   * Decodes a log into PayoutChangeCancelled data, preserving all log metadata.
   */
  decodePayoutChangeCancelled(log: EVMLog): DecodedLog<PayoutChangeCancelledDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as PayoutChangeCancelledDecoded }
  }

  /**
   * Creates a log trigger for PayoutChangeQueued events.
   * The returned trigger's adapt method decodes the raw log into PayoutChangeQueuedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerPayoutChangeQueued(
    filters?: PayoutChangeQueuedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChangeQueued' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChangeQueued' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'PayoutChangeQueued' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<PayoutChangeQueuedDecoded> => contract.decodePayoutChangeQueued(rawOutput),
    }
  }

  /**
   * Decodes a log into PayoutChangeQueued data, preserving all log metadata.
   */
  decodePayoutChangeQueued(log: EVMLog): DecodedLog<PayoutChangeQueuedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as PayoutChangeQueuedDecoded }
  }

  /**
   * Creates a log trigger for PayoutChanged events.
   * The returned trigger's adapt method decodes the raw log into PayoutChangedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerPayoutChanged(
    filters?: PayoutChangedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChanged' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'PayoutChanged' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'PayoutChanged' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<PayoutChangedDecoded> => contract.decodePayoutChanged(rawOutput),
    }
  }

  /**
   * Decodes a log into PayoutChanged data, preserving all log metadata.
   */
  decodePayoutChanged(log: EVMLog): DecodedLog<PayoutChangedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as PayoutChangedDecoded }
  }

  /**
   * Creates a log trigger for RegistrationRequested events.
   * The returned trigger's adapt method decodes the raw log into RegistrationRequestedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerRegistrationRequested(
    filters?: RegistrationRequestedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'RegistrationRequested' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
        requester: f.requester,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'RegistrationRequested' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
          requester: f.requester,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'RegistrationRequested' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<RegistrationRequestedDecoded> => contract.decodeRegistrationRequested(rawOutput),
    }
  }

  /**
   * Decodes a log into RegistrationRequested data, preserving all log metadata.
   */
  decodeRegistrationRequested(log: EVMLog): DecodedLog<RegistrationRequestedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as RegistrationRequestedDecoded }
  }

  /**
   * Creates a log trigger for VerificationRejected events.
   * The returned trigger's adapt method decodes the raw log into VerificationRejectedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerVerificationRejected(
    filters?: VerificationRejectedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'VerificationRejected' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        domainHash: f.domainHash,
      }
      const encoded = encodeEventTopics({
        abi: PayeeRegistryABI,
        eventName: 'VerificationRejected' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          domainHash: f.domainHash,
        }
        return encodeEventTopics({
          abi: PayeeRegistryABI,
          eventName: 'VerificationRejected' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<VerificationRejectedDecoded> => contract.decodeVerificationRejected(rawOutput),
    }
  }

  /**
   * Decodes a log into VerificationRejected data, preserving all log metadata.
   */
  decodeVerificationRejected(log: EVMLog): DecodedLog<VerificationRejectedDecoded> {
    const decoded = decodeEventLog({
      abi: PayeeRegistryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as VerificationRejectedDecoded }
  }
}

