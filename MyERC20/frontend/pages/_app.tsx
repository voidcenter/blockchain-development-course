import './globals.css';
import { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { Web3Modal } from "../context/Web3Modal";


function App({ Component, pageProps }: AppProps) {
    return (
        <Web3Modal>
            <Component {...pageProps} />
        </Web3Modal>
   );
}

export default dynamic(() => Promise.resolve(App), {
    ssr: false,
});

