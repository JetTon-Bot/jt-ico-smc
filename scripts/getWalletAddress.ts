import { address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonRoot } from '../wrappers/JettonRoot';

export async function run(provider: NetworkProvider) {
    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))
    


    console.log(await jettonLockup.getWalletAddress(address('EQAdbHMWKoMP5sX5cCgPLH60eqBv4iwD9gvWNUsw-de9RbA0')))
    // run methods on `jettonLockup`
}
