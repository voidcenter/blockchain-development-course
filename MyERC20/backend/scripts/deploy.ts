import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const decimals = 2;
  const tokens = 100;
  const token = await ethers.deployContract("MyERC20Token",
      ["My ERC20 Token", "MY20", decimals, tokens * 10**decimals]);

  console.log("Token address:", await token.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});


