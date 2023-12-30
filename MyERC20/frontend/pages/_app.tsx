import './globals.css';
import { AppProps } from 'next/app';
import dynamic from 'next/dynamic';


function App({ Component, pageProps }: AppProps) {
    return (
        <Component {...pageProps} />
    );
}

export default dynamic(() => Promise.resolve(App), {
    ssr: false,
});

