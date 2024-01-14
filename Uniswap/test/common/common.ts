import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";


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
