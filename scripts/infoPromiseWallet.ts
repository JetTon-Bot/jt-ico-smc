import { Address, address, toNano } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { PromiseWallet } from '../wrappers/PromiseWallet';

export async function run(provider: NetworkProvider) {

    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))

    const userJettonPromiseWallet = provider.open(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(provider.sender().address as Address)));

    // console.log(await jettonLockup.getUnlockedAmount())
    try {

        console.log(await userJettonPromiseWallet.getUnlockedAmount())

    } catch (e) {
        
    }

    console.log(await userJettonPromiseWallet.getAuthenticData())
    console.log(await userJettonPromiseWallet.getLockupsData())

}
