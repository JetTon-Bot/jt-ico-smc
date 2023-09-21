import { address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonRoot } from '../wrappers/JettonRoot';

export async function run(provider: NetworkProvider) {
    const jettonRoot = provider.open(JettonRoot.createFromConfig({
        owner: address('EQDNU1IyaUByY-bzYEX43eHG5fsDdgmh_Ev5O5O-Fe8tpoWD')
    }))
    

    await jettonRoot.sendDeploy(provider.sender())
    await provider.waitForDeploy(jettonRoot.address);
    console.log(jettonRoot.address)
    // run methods on `jettonLockup`
}
