// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { PayeeRegistryABI } from './PayeeRegistry'

export type PayeeRegistryMock = {
  aCTIONFREEZE?: () => number
  aCTIONVERIFY?: () => number
  dOMAINSEPARATOR?: () => `0x${string}`
  pAYOUTCHANGETYPEHASH?: () => `0x${string}`
  approvalSigner?: () => `0x${string}`
  changeDelay?: () => bigint
  domainAt?: (i: bigint) => readonly [`0x${string}`, string, number]
  domainCount?: () => bigint
  expectedAuthor?: () => `0x${string}`
  fingerprint?: (a: `0x${string}`) => `0x${string}`
  fingerprintOwner?: (arg0: `0x${string}`) => `0x${string}`
  forwarder?: () => `0x${string}`
  getPayee?: (d: `0x${string}`) => { domain: string; controller: `0x${string}`; payout: `0x${string}`; leiHash: `0x${string}`; status: number; verifiedAt: bigint; pendingPayout: `0x${string}`; payoutEta: bigint; pendingController: `0x${string}`; controllerEta: bigint }
  inspectRecipient?: (recipient: `0x${string}`) => readonly [number, `0x${string}`, `0x${string}`]
  nonces?: (arg0: `0x${string}`) => bigint
  payoutToDomain?: (arg0: `0x${string}`) => `0x${string}`
  resolve?: (d: `0x${string}`) => readonly [`0x${string}`, number]
  resolveName?: (domain: string) => readonly [`0x${string}`, number]
  supportsInterface?: (interfaceId: `0x${string}`) => boolean
} & Pick<ContractMock<typeof PayeeRegistryABI>, 'writeReport'>

export function newPayeeRegistryMock(address: Address, evmMock: EvmMock): PayeeRegistryMock {
  return addContractMock(evmMock, { address, abi: PayeeRegistryABI }) as PayeeRegistryMock
}

