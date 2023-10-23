import { Cell, address, toNano } from 'ton-core';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { JettonLockup } from '../wrappers/JettonLockup';
import { JettonRoot } from '../wrappers/JettonRoot';

export async function run(provider: NetworkProvider) {

    const jettonRoot = provider.open(JettonRoot.createFromAddress(
        address('EQAQXlWJvGbbFfE8F3oS8s87lIgdovS455IsWFaRdmJetTon')
    ))


    const jettonLockup = provider.open(JettonLockup.createFromConfig({
        name: "Test Promise Jetton",
        symbol: "TestPJetton",
        image: "https://raw.githubusercontent.com/JetTon-Bot/JetTon/main/jetton-256.png",
        description: "Description of test",
        regulator: address('EQDNU1IyaUByY-bzYEX43eHG5fsDdgmh_Ev5O5O-Fe8tpoWD'),
        authenticRoot: jettonRoot.address,
        authenticWalletCode: await jettonRoot.getWalletCode(),
        walletCode: await compile('PromiseWallet'),
        startTime: 0,
        endTime: Math.round(Date.now()/1000) + 36*31*24*60*60,
        maxMonths: 12
    }, await compile('JettonLockup')))

    const authenticWalletAddr = await jettonRoot.getWalletAddress(jettonLockup.address)

    await jettonLockup.sendDeploy(provider.sender(), authenticWalletAddr)
    await provider.waitForDeploy(jettonLockup.address);
    console.log(jettonLockup.address)
    // run methods on `jettonLockup`
}
