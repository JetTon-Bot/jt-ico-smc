import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary, DictionaryValue, Sender, SendMode, toNano} from 'ton-core';
import { Builder } from 'ton-core';
import { serialize } from 'v8';

export type lockedAmount = {
    startUnlockTime: number;
    endUnlockTime: number;
    lastReceived: number;
    lockedAmount: bigint;
    unlockedAmount: bigint;
};

export type getUnlockedAmountInfo = {
    lockedAmounts: lockedAmount[];
    unlockedAmount: bigint;
};

export type getWalletData = {
    balance: bigint;
    ownerAddress: Address;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
};

export type authenticData = {
    jettonWallet: Address;
    master: Address;
    balance: bigint;
    walletCode: Cell;
};

export type lockupsData = {
    tokensAvailable: bigint;
    tokensLocked: bigint;
    lastRecieved: number;
    lockupsHistory: lockedAmount[];
};

function createDictValue(): DictionaryValue<lockedAmount> {
    return {
        serialize: (src, builder) => {
            builder.storeUint(src.startUnlockTime, 32)
            builder.storeUint(src.endUnlockTime, 32)
            builder.storeUint(src.lastReceived, 32)
            builder.storeCoins(src.lockedAmount)
            builder.storeCoins(src.unlockedAmount)
        },
        parse: (src) => {
            return {
                startUnlockTime: src.loadUint(32),
                endUnlockTime: src.loadUint(32),
                lastReceived: src.loadUint(32),
                lockedAmount: src.loadCoins(),
                unlockedAmount: src.loadCoins(),
            }
        },
    }
}

export class PromiseWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new PromiseWallet(address);
    }



    async send(provider: ContractProvider, via: Sender, value: bigint, body: Cell) {
        await provider.internal(via, {
            value,
            sendMode: 1,
            body: body,
        });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        forwardValue: bigint,
        forwardPayload: Cell | null,
        recipient: Address,
        amount: bigint
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x0f8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(amount)
                .storeAddress(recipient)
                .storeAddress(recipient)
                .storeUint(0, 1)
                .storeCoins(forwardValue)
                .storeMaybeRef(forwardPayload)
                .endCell(),
            value: value + forwardValue,
        });
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        response: Address,
        amount: bigint
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x595f07bc, 32)
                .storeUint(0, 64)
                .storeCoins(amount)
                .storeAddress(response)
                .endCell(),
            value: value
        });
    }


    async getUnlockedAmount(provider: ContractProvider): Promise<getUnlockedAmountInfo> {
        const stack = (await provider.get("get_unlocked_amount", [])).stack

        let lockedAmounts: lockedAmount[];

        try {
            lockedAmounts = stack.readCell().beginParse().loadDictDirect(Dictionary.Keys.Uint(16), createDictValue()).values();
        } catch {
            lockedAmounts = [];
        }

        return {
            lockedAmounts: lockedAmounts,
            unlockedAmount: stack.readBigNumber(),
        }
    }

    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }

    async getWalletAddress(provider: ContractProvider, owner: Address) {
        const { stack } = await provider.get("get_wallet_address", [
            {type: 'slice', cell: beginCell().storeAddress(owner).endCell()}
        ]);
        return stack.readAddress();
    }

    async getAuthenticData(provider: ContractProvider): Promise<authenticData> {
        const { stack } = await provider.get("get_authentic_data", []);
        
        return {
            jettonWallet: stack.readAddress(),
            master: stack.readAddress(),
            balance: stack.readBigNumber(),
            walletCode: stack.readCell()
        };
    }

    async getLockupsData(provider: ContractProvider): Promise<lockupsData> {
        const { stack } = await provider.get("get_lockups_data", []);

        const tokensAvailable = stack.readBigNumber();
        const tokensLocked = stack.readBigNumber();
        const lastRecieved = stack.readNumber();

        let lockedAmounts: lockedAmount[];

        try {
            lockedAmounts = stack.readCell().beginParse().loadDictDirect(Dictionary.Keys.Uint(16), createDictValue()).values();
        } catch {
            lockedAmounts = [];
        }

        return {
            tokensAvailable,
            tokensLocked,
            lastRecieved,
            lockupsHistory: lockedAmounts,
        }
    }

}