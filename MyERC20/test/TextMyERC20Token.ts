import { ethers } from "hardhat";
const { expect } = require("chai");

describe("Token contract", function () {
  it("Deployment should assign the total supply of tokens to the owner", async function () {
    const [owner] = await ethers.getSigners();

    const token = await ethers.deployContract("MyERC20Token", ["My ERC20 Token", "MY20", 18, 1000]);

    const ownerBalance = await token.balanceOf(owner.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
  });

  it("Allowance can be changed", async function () {
    const [owner] = await ethers.getSigners();

    const token = await ethers.deployContract("MyERC20Token", ["My ERC20 Token", "MY20", 18, 1000]);

    const spender = "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2";
    console.log(await token.allowance(owner.address, spender));
    await token.approve(spender, 100);
    console.log(await token.allowance(owner.address, spender));
    await token.approve(spender, 10);
    console.log(await token.allowance(owner.address, spender));

});
});

