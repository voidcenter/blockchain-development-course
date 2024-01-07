import { ethers } from "hardhat";
const { expect } = require("chai");

describe("E2E Test", function () {
  it("E2E test should succeed", async function () {
    const [owner] = await ethers.getSigners();
    console.log('owner address = ', owner.address)

    // create token0 and token1
    const token0 = await ethers.deployContract("MyERC20TokenOZ", ["Token0", "T0", 0, 10000]);
    const token1 = await ethers.deployContract("MyERC20TokenOZ", ["Token1", "T1", 0, 10000]);

    expect(await token0.totalSupply()).to.equal(await token0.balanceOf(owner.address));
    expect(await token1.totalSupply()).to.equal(await token1.balanceOf(owner.address));
    console.log('token0 = ', token0.target);
    console.log('token1 = ', token1.target);

    // create factory
    const factory = await ethers.deployContract("UniswapV2Factory", []);
    expect(await factory.allPairsLength()).to.equal(0);
    console.log('factory = ', factory.target);

    // create pair
    // console.log(token0);
    await factory.createPair(token0.target, token1.target);        
    const pairAddress = await factory.getPair(token0.target, token1.target);
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const pair = await UniswapV2PairFactory.attach(pairAddress) as any;

    console.log('pair = ', pairAddress);
    console.log('pair: symbol = ', await pair.symbol(), ', token0 = ', await pair.token0(), ', token1 = ', await pair.token1(), 
                ', reserves = ', await pair.getReserves()); 

    // create router 
    const router = await ethers.deployContract("UniswapV2Router02", [factory.target]);

    /* interact with router */

    // add liquidity
    const time_in_the_future = Date.now() + 1000000000;
    await router.addLiquidity(token0.target, token1.target, 1000, 1000, 0, 0, owner.address, time_in_the_future);


    
  });
});


