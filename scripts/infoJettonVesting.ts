import { address } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';

export async function run(provider: NetworkProvider) {
    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQDfawGU5j-A2BdinwruM7-00orzhlhNPyHRr8rWGdxCUI5O')))
    // console.log(await jettonLockup.getUnlockedAmount())
    try {

        console.log(await jettonLockup.getContractData())
        
    } catch (e) {
        
    }
    
}
