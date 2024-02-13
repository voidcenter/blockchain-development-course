import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { bls12_381 } from '@noble/curves/bls12-381';


async function blsExample() {
    // Generate private key
    const privateKey = bls12_381.utils.randomPrivateKey();
  
    // Get the public key corresponding to the private key
    const publicKey = bls12_381.getPublicKey(privateKey);
  
    // Sign a message
    const message = new TextEncoder().encode('Hello, world!');
    const signature = await bls12_381.sign(message, privateKey);
  
    // Verify the signature
    const isValid = await bls12_381.verify(signature, message, publicKey);
  
    console.log('Public Key:', publicKey);
    console.log('Signature:', signature);
    console.log('Signature valid:', isValid);
  }



async function main() {
    // console.log(bls);

    // const p = bls.G1.Point.BASE.multiply(bls.fields.Fr.ONE);
    // await blsExample();


    console.log(bls.G1.ProjectivePoint.BASE)

    console.log("test");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});


