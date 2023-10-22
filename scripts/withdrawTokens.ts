import { Address, address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonRoot } from '../wrappers/JettonRoot';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonWallet } from '../wrappers/JettonWallet';
import { PromiseWallet } from '../wrappers/PromiseWallet';

export async function run(provider: NetworkProvider) {

    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))

    const userJettonPromiseWallet = provider.open(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(provider.sender().address as Address)));
    const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();

    await userJettonPromiseWallet.sendBurn(
        provider.sender(),
        BigInt(3e8),
        jettonLockup.address,
        lockedAmounts.unlockedAmount
    )
    // run methods on `jettonLockup`
}


// EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U -- wallet

