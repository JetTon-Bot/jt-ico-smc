import { Address, address, toNano } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { PromiseWallet } from '../wrappers/PromiseWallet';

export async function run(provider: NetworkProvider) {


    const userJettonPromiseWallet = provider.open(PromiseWallet.createFromAddress(address('EQAnWpfowuPUfPBbp7rummH-dIknkvxa8kdVDH80ahPWw0Uy')))

    // console.log(await jettonLockup.getUnlockedAmount())
    try {


    } catch (e) {
        
    }

    console.log(await userJettonPromiseWallet.getAuthenticData())
    console.log(await userJettonPromiseWallet.getLockupsData())

}
