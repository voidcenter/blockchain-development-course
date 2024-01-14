import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
require('dotenv').config()

const { ALCHEMY_SEPOLIA_KEY, ACCOUNT_PRIVATE_KEY, ACCOUNT_PRIVATE_KEY_2, ETHERSCAN_KEY } = process.env;


const config: HardhatUserConfig = {
  solidity: "0.8.22",
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_SEPOLIA_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY!, ACCOUNT_PRIVATE_KEY_2!]
    }
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_KEY!,
    }
  }
};

export default config;


