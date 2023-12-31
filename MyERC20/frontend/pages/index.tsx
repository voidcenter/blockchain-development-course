
import { useEffect } from "react";
import { readContract, writeContract } from "wagmi/actions";
const mud_abi = require('../../common/GameSystem.abi.json');

const MyERC20TokenAddress = "0x5ae8b20195d12da6A5F1ae5d9fFD775464E952bc";

export default function Home() {

    useEffect(() => {
        const run = async () => {

            await readContract({
                address: MyERC20TokenAddress,
                abi: this.mud_abi,
                functionName: name,
                args: [],
            });

        };

        run();
    });

    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
            <div className="fixed top-0 right-0 rounded-full">   
                <w3m-button />
            </div>
        </main>
    )
}



