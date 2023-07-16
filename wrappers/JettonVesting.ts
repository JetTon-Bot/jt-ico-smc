import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from 'ton-core';

export type JettonVestingConfig = {
    jettonMaster: Address,
    wrappedWalletCode: Cell
};

export function jettonVestingConfigToCell(config: JettonVestingConfig): Cell {
    return beginCell()
        .storeAddress(config.jettonMaster)
        .storeUint(0, 2)
        .storeCoins(0)
        .storeRef(config.wrappedWalletCode)
        .endCell();
}

export class JettonVesting implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonVesting(address);
    }

    static createFromConfig(config: JettonVestingConfig, code: Cell, workchain = 0) {
        const data = jettonVestingConfigToCell(config);
        const init = { code, data };
        return new JettonVesting(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: 1,
            body: beginCell().endCell(),
            bounce: false
        });
    }

    async getVestingData(provider: ContractProvider) {
        const { stack } = await provider.get("vesting_data", []);
        return [stack.readAddress(), stack.readBoolean()];
    }

    async getWalletAddress(provider: ContractProvider, owner: Address) {
        const { stack } = await provider.get("get_wallet_address", [
            {type: 'slice', cell: beginCell().storeAddress(owner).endCell()}
        ]);
        return stack.readAddress();
    }
}
