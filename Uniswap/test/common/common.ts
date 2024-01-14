import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
const util = require('util');
const exec = util.promisify(require('child_process').exec);


// For simplicity, we use 18 for all tokens involved
export const DECIMALS = 18n;
export const DECIMALS_MULTIPLIER = 10n**DECIMALS;

// We mint 1 billion tokens for each token
export const TEST_TOKEN_INITIAL_SUPPLY = 10n ** 9n * DECIMALS_MULTIPLIER  ;


export interface Signers {
    owner: HardhatEthersSigner;
    swapper?: HardhatEthersSigner;
}


export async function getSigners() {
    const [owner, swapper] = await ethers.getSigners();
    return { owner, swapper };
}

export const color = new (class {
    color = (code: number, ...messages: any[]) =>
      `\x1b[${code}m${messages.join(" ")}\x1b[0m`;
    black = this.color.bind(null, 30);
    red = this.color.bind(null, 31);
    green = this.color.bind(null, 32);
    yellow = this.color.bind(this, 33);
    blue = this.color.bind(this, 34);
    magenta = this.color.bind(this, 35);
    cyan = this.color.bind(this, 36);
    white = this.color.bind(this, 37);
    bgBlack = this.color.bind(this, 40);
    bgRed = this.color.bind(this, 41);
    bgGreen = this.color.bind(this, 42);
    bgYellow = this.color.bind(this, 43);
    bgBlue = this.color.bind(this, 44);
    bgMagenta = this.color.bind(this, 45);
    bgCyan = this.color.bind(this, 46);
    bgWhite = this.color.bind(this, 47);
})();
  

export const getBigIntAmountFormater = (decimals: bigint) => (x: bigint) => {
    const decimalsMultipler = 10n**decimals;
    const text = `${x.toString()} [${(Number(x) / Number(decimalsMultipler)).toFixed(2)}]`;
    return color.yellow(text);
}


// Because EMV txns needs to be awaited twice, like:
// const tx = await contract.func(args);
// await tx.wait();
// or 
// await (await contract.func(args)).wait();
// 
// We create this syntatical sugar to make it look cleaner:
// await tx(contract.func(args));
export const tx = async (txPromise: Promise<any>) => {
    return await (await txPromise).wait();
}

export const deployTx = async (txPromise: Promise<any>) => {
    return await (await txPromise).waitForDeployment();
}


export async function sleep(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


export async function verifyContract(address: string,  initArgsStr: string) {
    const cmd = `npx hardhat verify --network sepolia ${address} ${initArgsStr}`;
    console.log(cmd);
    await exec(cmd);
};


export async function getPairContractFromAddress(pairAddress: string): Promise<UniswapV2Pair> {
    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");
    return await UniswapV2Pair.attach(pairAddress) as any;
}


export async function getPairContract(factory: UniswapV2Factory, token0: string, token1: string): Promise<UniswapV2Pair> {
    const pairAddress = await factory.getPair(token0, token1);
    return getPairContractFromAddress(pairAddress);
}

