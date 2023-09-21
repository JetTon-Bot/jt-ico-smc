import { address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonRoot } from '../wrappers/JettonRoot';

export async function run(provider: NetworkProvider) {
    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))
    console.log(await jettonLockup.getContractData())
    
    
}
