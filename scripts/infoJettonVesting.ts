import { address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonRoot } from '../wrappers/JettonRoot';
import { PromiseWallet } from '../wrappers/PromiseWallet';

export async function run(provider: NetworkProvider) {
    const jettonLockup = provider.open(PromiseWallet.createFromAddress(address('EQDfawGU5j-A2BdinwruM7-00orzhlhNPyHRr8rWGdxCUI5O')))
    // console.log(await jettonLockup.getUnlockedAmount())
    try {
        console.log(await jettonLockup.getUnlockedAmount())
    } catch (e) {
        
    }
    console.log(await jettonLockup.getJettonBalance())
    console.log(await jettonLockup.getAuthenticData())
    
}
