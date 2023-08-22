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
    vestingPeriod: number;
    prices: Price[];
    availableTokens: bigint;
    minAmount: bigint;
    maxAmount: bigint;
};

export type JettonGetInfo = {
    isInitialized: number;
    totalSupply: bigint;
    regulator: Address;
    content: string;
    walletCode: Cell;
    authenticJwall: Address;
    promiseJwall: Address;
    availableAuthenticAmount: bigint;
    startTime: number;
    endTime: number;
    vestingPeriod: number;
    availableTokens: bigint;
    redeemedTokens: bigint;
    prices: Cell;
    minAmount: bigint;
    maxAmount: bigint;
    receivedTokens: bigint;
}

function createPriceValue(): DictionaryValue<bigint> {
    return {
        serialize: (src, builder) => {
            builder.storeCoins(src)
        },
        parse: (src) => {
            return src.loadCoins()
        },
    }
}

function pricesToDict(prices: Price[]): Dictionary<number, bigint> {
    let dict = Dictionary.empty(Dictionary.Keys.Uint(4), createPriceValue());
    for (let i = 0; i < prices.length; i++) {
        dict.set(prices[i].lockMonths, prices[i].price);
    }
    return dict;
}

export function jettonLockupConfigToCell(config: JettonLockupConfig): Cell {
    const prices = pricesToDict(config.prices);
    
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
                .storeCoins(0)
            .endCell()
        )
        .storeRef(
            beginCell() 
            .storeRef(
                beginCell()
                    .storeUint(config.startTime, 32)
                    .storeUint(config.endTime, 32)
                    .storeUint(config.vestingPeriod, 32)
                .endCell()
            )
            .storeRef(
                beginCell()
                    .storeCoins(config.availableTokens)
                    .storeCoins(0)
                    .storeDict(prices)
                    .storeCoins(config.minAmount)
                    .storeCoins(config.maxAmount)
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
            .storeUint(1478, 32)
            .storeUint(0, 64)
            .storeAddress(authenticJwall)
            .endCell();


        const value = toNano('0.05')
        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        });
    }

    async send(provider: ContractProvider, via: Sender, value: bigint, body: Cell) {
        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        });
    }

    async sendBuyRequest(provider: ContractProvider, via: Sender, value: bigint, lockupMonths: number) {
        const body = beginCell()
            .storeUint(1487, 32)
            .storeUint(0, 64)
            .storeUint(lockupMonths, 4)
            .endCell();

        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        })
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
            availableAuthenticAmount: stack.readBigNumber(),
            startTime: stack.readNumber(),
            endTime: stack.readNumber(),
            vestingPeriod: stack.readNumber(),
            availableTokens: stack.readBigNumber(),
            redeemedTokens: stack.readBigNumber(),
            prices: stack.readCell(),
            minAmount: stack.readBigNumber(),
            maxAmount: stack.readBigNumber(),
            receivedTokens: stack.readBigNumber()
        }
    }
}