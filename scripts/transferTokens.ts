import { Address, address } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { PromiseWallet } from '../wrappers/PromiseWallet';

export async function run(provider: NetworkProvider) {

    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))

    const userJettonPromiseWallet = provider.open(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(provider.sender().address as Address)));
    const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();

    await userJettonPromiseWallet.sendTransfer(
        provider.sender(),
        BigInt(3e8),
        BigInt(3e8),
        null,
        address('EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U'),
        lockedAmounts.unlockedAmount
    )
    // run methods on `jettonLockup`
}


// EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U -- wallet

