// EIP-712 approvals that the contracts verify. Typehashes MUST match the Solidity strings exactly:
//   PayeeRegistry: PayoutChange(bytes32 domainHash,address newPayout,uint256 nonce,uint256 deadline)
//   AgentWallet:   RaiseLimits(address wallet,address token,uint128 perPayment,uint128 perDay,uint256 nonce,uint256 deadline)
import { privateKeyToAccount } from 'viem/accounts'

export const payoutChangeTypes = {
  PayoutChange: [
    { name: 'domainHash', type: 'bytes32' },
    { name: 'newPayout', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

export const raiseLimitsTypes = {
  RaiseLimits: [
    { name: 'wallet', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'perPayment', type: 'uint128' },
    { name: 'perDay', type: 'uint128' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

export function makeSigner(privateKey) {
  const account = privateKeyToAccount(privateKey)
  return {
    address: account.address,
    signPayoutChange: ({ chainId, registry, domainHash, newPayout, nonce, deadline }) =>
      account.signTypedData({
        domain: { name: 'VerifyPay', version: '1', chainId, verifyingContract: registry },
        types: payoutChangeTypes,
        primaryType: 'PayoutChange',
        message: { domainHash, newPayout, nonce: BigInt(nonce), deadline: BigInt(deadline) },
      }),
    signRaiseLimits: ({ chainId, wallet, token, perPayment, perDay, nonce, deadline }) =>
      account.signTypedData({
        domain: { name: 'VerifyPayAgentWallet', version: '1', chainId, verifyingContract: wallet },
        types: raiseLimitsTypes,
        primaryType: 'RaiseLimits',
        message: { wallet, token, perPayment: BigInt(perPayment), perDay: BigInt(perDay), nonce: BigInt(nonce), deadline: BigInt(deadline) },
      }),
  }
}
