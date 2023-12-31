"use client";

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'

import { WagmiConfig } from 'wagmi'
import { sepolia, mainnet } from 'viem/chains'


// Get projectId
// https://cloud.walletconnect.com/app/project?uuid=665412c9-1983-4dd4-9287-db8fc0e28069
const projectId = 'd72f1e6c7cb9b25f743a76288fe68cd7'

// Create the metadata object.
const metadata = {
    name: 'MyERC20Token',
    description: 'MyERC20 Token Example',
    url: 'https://web3modal.com',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
}
  
// List the chains you want to support.
const chains = [sepolia, mainnet]

// Create the WagmiConfig object.
const wagmiConfig = defaultWagmiConfig({ chains, projectId, metadata })

// Create the Web3Modal component.
createWeb3Modal({ wagmiConfig, projectId, chains,
    themeMode: 'light',
})

// Export the Web3Modal component.
export function Web3Modal({ children }: any) {
    return <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>;
}

