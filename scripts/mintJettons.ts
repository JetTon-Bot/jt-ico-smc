import { address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonRoot } from '../wrappers/JettonRoot';

export async function run(provider: NetworkProvider) {
    const jettonRoot = provider.open(JettonRoot.createFromAddress(
        address('EQDBsaZk5EgkcWhUbObZF0a62T2PGQnY-x3qgKyRjeoErG5S')
    ))

    await jettonRoot.sendMintJettons(
        provider.sender(),
        address('EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U'),
        BigInt(10000*1e9)
    )
    // run methods on `jettonLockup`
}


// EQAtGA68pp_0LW1mWqlXzJsfOxAknUbfEQX42qKBACiU1m3U -- wallet

