import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { formatUnitsFixed, usdcDecimalsFor } from '@/onchain-money';
import { useWallet } from './walletContext';

export interface TokenBalance {
  raw: bigint;
  decimals: number;
  /** Truncated to 2 decimals for display. */
  display: string;
}

export interface Balances {
  usdc: TokenBalance;
  eurc: TokenBalance;
}

/** EURC is a 6-decimal ERC-20 on Arc; the contract is asked, and anything else is an error rather than a guess. */
export const EURC_EXPECTED_DECIMALS = 6;

/** Live USDC and EURC balances of the connected wallet, read with ERC20.balanceOf and refreshed on a timer and after every transaction. */
export function useBalances() {
  const { config, publicClient, account } = useWallet();

  return useQuery<Balances>({
    queryKey: ['balances', account, config.usdc, config.eurc],
    enabled: account !== null,
    refetchInterval: 8000,
    queryFn: async () => {
      if (!account) throw new Error('No connected account');
      const [usdcRaw, eurcRaw, eurcDecimals] = await Promise.all([
        publicClient.readContract({ address: config.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ address: config.eurc, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ address: config.eurc, abi: erc20Abi, functionName: 'decimals' }),
      ]);
      if (eurcDecimals !== EURC_EXPECTED_DECIMALS) {
        throw new Error(`EURC reports ${eurcDecimals} decimals; this app only handles ${EURC_EXPECTED_DECIMALS}`);
      }
      const usdcDecimals = usdcDecimalsFor(config.chainId);
      return {
        usdc: { raw: usdcRaw, decimals: usdcDecimals, display: formatUnitsFixed(usdcRaw, usdcDecimals, 2) },
        eurc: { raw: eurcRaw, decimals: eurcDecimals, display: formatUnitsFixed(eurcRaw, eurcDecimals, 2) },
      };
    },
  });
}
