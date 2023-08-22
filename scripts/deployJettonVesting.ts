// import { Address, toNano } from 'ton-core';
// import { JettonVesting } from '../wrappers/JettonRoot';
// import { compile, NetworkProvider, UIProvider} from '@ton-community/blueprint';
// import { promptAddress, promptBool, promptUrl } from '../wrappers/ui-utils';

// export async function run(provider: NetworkProvider) {
//     const ui       = provider.ui();
//     const sender   = provider.sender();
//     const adminPrompt = 'Please specify jetton master address:';

//     let jettonMaster = await promptAddress(adminPrompt, ui, sender.address);
//     ui.write(`Jetton master address:${jettonMaster}\n`);

//     const wrappedWalletCode = await compile('WrappedWallet');
//     const vestingCode = await compile('JettonVesting');

//     const minter = JettonVesting.createFromConfig(
//         {jettonMaster, wrappedWalletCode}, vestingCode);

//     await provider.deploy(minter, toNano('0.05'));
// }