import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary, DictionaryValue, Sender, toNano} from 'ton-core';
import { Builder } from 'ton3';
import { serialize } from 'v8';

export type Price = {
    lockMonths: number;
    price: bigint;
};

export type JettonLockupConfig = {
    regulator: Address;
    walletCode: Cell,
    startTime: number;
    endTime: number;
    maxMonths: number;
};

export type JettonGetInfo = {
    isInitialized: number;
    totalSupply: bigint;
    regulator: Address;
    content: string;
    walletCode: Cell;
    authenticJwall: Address;
    promiseJwall: Address;
    startTime: number;
    endTime: number;
    maxMonths: number;
    redeemedTokens: bigint;
}


export function jettonLockupConfigToCell(config: JettonLockupConfig): Cell {
    return beginCell()
        .storeInt(0, 2)
        .storeRef(
            beginCell()
                .storeCoins(0)
                .storeAddress(config.regulator)
                .storeRef(beginCell().endCell())
                .storeRef(config.walletCode)
            .endCell()
        )
        .storeRef(
            beginCell()
                .storeAddress(null)
                .storeAddress(null)
            .endCell()
        )
        .storeRef(
            beginCell() 
            .storeRef(
                beginCell()
                    .storeUint(config.startTime, 32)
                    .storeUint(config.endTime, 32)
                    .storeUint(config.maxMonths, 4)
                .endCell()
            )
            .storeRef(
                beginCell()
                    .storeCoins(0)
                .endCell()
            )
            .endCell()
        )
        .endCell();
}

export class JettonLockup implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonLockup(address);
    }

    static createFromConfig(config: JettonLockupConfig, code: Cell, workchain = 0) {
        const data = jettonLockupConfigToCell(config);
        const init = { code, data };
        return new JettonLockup(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, authenticJwall: Address) {
        const body = beginCell()
            .storeUint(2001, 32)
            .storeUint(0, 64)
            .storeAddress(authenticJwall)
            .endCell();


        const value = toNano('2')
        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        });
    }

    async sendMaintain(provider: ContractProvider, via: Sender, msg: Cell, mode: number) {
        const body = beginCell()
            .storeUint(2003, 32)
            .storeUint(0, 64)
            .storeUint(2003, 32)
            .storeUint(mode, 8)
            .storeRef(msg)
            .endCell()
        
        await provider.internal(via, {
            value: toNano('0.2'),
            sendMode: 1,
            body: body
        })
    }

    async sendSetData(provider: ContractProvider, via: Sender, newData: Cell) {
        const body = beginCell()
            .storeUint(2003,32)
            .storeUint(0, 64)
            .storeUint(2004,32)
            .storeMaybeRef(newData)
            .storeMaybeRef(null)
            .endCell()
        
        await provider.internal(via, {
            value: toNano('0.2'),
            sendMode: 1,
            body: body
        })
    }

    async send(provider: ContractProvider, via: Sender, value: bigint, body: Cell) {
        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        });
    }

    async bodyForLock(lockupPeriodMonths: number, receiver: Address): Promise<Cell> {
        return beginCell()
            .storeUint(2002, 32)
            .storeUint(lockupPeriodMonths, 4)
            .storeAddress(receiver)
            .endCell();
    }

    async getSupply(provider: ContractProvider) {
        const { stack } = await provider.get("get_jetton_data", []);
        return stack.readNumber();
    }

    async getWalletAddress(provider: ContractProvider, owner: Address) {
        const { stack } = await provider.get("get_wallet_address", [
            {type: 'slice', cell: beginCell().storeAddress(owner).endCell()}
        ]);
        return stack.readAddress();
    }

    async getContractData(provider: ContractProvider): Promise<JettonGetInfo> {
        const { stack } = await provider.get("get_contract_data", []);
        return {
            isInitialized: stack.readNumber(),
            totalSupply: stack.readBigNumber(),
            regulator: stack.readAddress(),
            content: stack.readCell().toString(),
            walletCode: stack.readCell(),
            authenticJwall: stack.readAddress(),
            promiseJwall: stack.readAddress(),
            startTime: stack.readNumber(),
            endTime: stack.readNumber(),
            maxMonths: stack.readNumber(),
            redeemedTokens: stack.readBigNumber(),
        }
    }
}