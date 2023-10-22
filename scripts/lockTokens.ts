import { Address, address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonRoot } from '../wrappers/JettonRoot';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonWallet } from '../wrappers/JettonWallet';

export async function run(provider: NetworkProvider) {

    const jettonRoot = provider.open(JettonRoot.createFromAddress(
        address('EQAQXlWJvGbbFfE8F3oS8s87lIgdovS455IsWFaRdmJetTon')
    ))

    const ownerJettonWallet = provider.open(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(provider.sender().address as Address)));

    const jettonLockup = provider.open(JettonLockup.createFromAddress(address('EQAr-as5bebuOkARzPMFVFP2KL-kFf0oBxNTEF4KuDp1HbXm')))

    await ownerJettonWallet.sendTransfer(
        provider.sender(),
        BigInt(1e8 * 3),
        BigInt(1e8 * 2),
        await jettonLockup.bodyForLock(5, provider.sender().address as Address),
        jettonLockup.address,
        BigInt(1e9 * 100)
    )
    // run methods on `jettonLockup`
}


// EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U -- wallet

