import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Cell, toNano, fromNano, beginCell, Address } from 'ton-core';
import { JettonVesting, JettonRoot } from '../wrappers';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('JettonVesting', () => {
    let jettonVestingCode: Cell, wrappedWalletCode: Cell;
    let blockchain: Blockchain;
    let jettonVesting: SandboxContract<JettonVesting>, jettonRoot: SandboxContract<JettonRoot>;
    let owner: SandboxContract<TreasuryContract>, receiver: SandboxContract<TreasuryContract>;
    let ownerWalletAddress: Address, vestingWalletAddress: Address;
    let wrapOwnerWalletAddress: Address, wrapReceiverWalletAddress: Address;
    let startedUnixTime = 0;

    beforeAll(async () => {
        jettonVestingCode = await compile('JettonVesting');
        wrappedWalletCode = await compile('WrappedWallet');
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        owner = await blockchain.treasury('owner');
        receiver = await blockchain.treasury('receiver');
    });

    it('should deploy & mint test coins', async () => {
        startedUnixTime = blockchain.now || 0;

        jettonRoot = blockchain.openContract(
            JettonRoot.createFromConfig({
                owner: owner.address,
            })
        );

        let deployResult = await jettonRoot.sendDeploy(owner.getSender());
        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonRoot.address,
            deploy: true,
        });

        jettonVesting = blockchain.openContract(
            JettonVesting.createFromConfig({
                jettonMaster: jettonRoot.address,
                wrappedWalletCode,
            }, jettonVestingCode)
        );

        deployResult = await jettonVesting.sendDeploy(owner.getSender());
        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonVesting.address,
            deploy: true,
        });

        ownerWalletAddress = await jettonRoot.getWalletAddress(owner.address);
        vestingWalletAddress = await jettonRoot.getWalletAddress(jettonVesting.address);

        let mintResult = await jettonRoot.send(
            owner.getSender(), toNano('0.1'),
            beginCell()
                .storeUint(21, 32)
                .storeUint(0, 64)
                .storeAddress(owner.address)
                .storeCoins(toNano('0.07'))
                .storeRef(
                    beginCell()
                        .storeUint(0x178d4519, 32)
                        .storeUint(0, 64)
                        .storeCoins(toNano('1000000'))
                        .storeAddress(null)
                        .storeAddress(null)
                        .storeCoins(toNano('0.02'))
                        .storeUint(0, 1)
                        .endCell()
                )
                .endCell()
        );
        expect(fromNano(await jettonRoot.getSupply())).toBe("1000000")
        expect(mintResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonRoot.address,
            success: true,
        });
        expect((await jettonVesting.getVestingData())[1]).toBe(false);
    });

    it('should init vesting by jetton transfer', async () => {
        await owner.send({
            'to': ownerWalletAddress,
            'value': toNano('0.5'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('1000'))
                .storeAddress(jettonVesting.address)
                .storeAddress(owner.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.2'))
                .storeUint(0, 1)
                .endCell()
        });
        expect((await jettonVesting.getVestingData())[1]).toBe(true);
    });

    it('should deposit jettons to vesting', async () => {
        wrapOwnerWalletAddress = await jettonVesting.getWalletAddress(owner.address);
        wrapReceiverWalletAddress = await jettonVesting.getWalletAddress(receiver.address);
        await owner.send({
            'to': ownerWalletAddress,
            'value': toNano('0.1'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('1000'))
                .storeAddress(jettonVesting.address)
                .storeAddress(owner.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.05'))
                .storeUint(0, 1)
                .endCell()
        });

        let result = (await blockchain.getContract(wrapOwnerWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('1000'));
    });

    it('should send jettons to some investor with lockup args', async () => {        
        await owner.send({
            'to': wrapOwnerWalletAddress,
            'value': toNano('0.05'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('500'))
                .storeAddress(receiver.address)
                .storeAddress(owner.address)
                .storeMaybeRef(
                    beginCell()
                        .storeUint(0, 64)
                        .storeUint(2, 16)
                        .storeUint(20, 64)
                        .endCell()
                )
                .storeCoins(toNano('0.001'))
                .storeUint(0, 1)
                .endCell()
        });

        let result = (await blockchain.getContract(wrapReceiverWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('500'));
    });

    it('investor should not be able to send jettons before lockup period to owner', async () => {
        await receiver.send({
            'to': wrapReceiverWalletAddress,
            'value': toNano('0.05'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('250'))
                .storeAddress(owner.address)
                .storeAddress(receiver.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.001'))
                .storeUint(0, 1)
                .endCell()
        });

        let result = (await blockchain.getContract(wrapReceiverWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('500'));
    });

    it('investor should be able to send jettons after lockup period to owner', async () => {
        blockchain.now = startedUnixTime + 11;
        await receiver.send({
            'to': wrapReceiverWalletAddress,
            'value': toNano('0.05'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('250'))
                .storeAddress(owner.address)
                .storeAddress(receiver.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.001'))
                .storeUint(0, 1)
                .endCell()
        });

        let result = (await blockchain.getContract(wrapReceiverWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('250'));
    });

    it('should be able to unwrap jettons', async () => {
        let result = (await blockchain.getContract(wrapOwnerWalletAddress)).get('get_locks_data');
        if (result.stack[2].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[2].value).toBe(toNano('0'));

        await owner.send({
            'to': wrapOwnerWalletAddress,
            'value': toNano('0.2'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('750'))
                .storeAddress(jettonVesting.address)
                .storeAddress(owner.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.001'))
                .storeUint(0, 1)
                .endCell()
        });

        result = (await blockchain.getContract(wrapOwnerWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('0'));

        result = (await blockchain.getContract(ownerWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('999750'));
    });

    it('new wrap should be created after unwrap', async () => {
        await owner.send({
            'to': ownerWalletAddress,
            'value': toNano('0.2'),
            'body': beginCell()
                .storeUint(0xf8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(toNano('1000'))
                .storeAddress(jettonVesting.address)
                .storeAddress(owner.address)
                .storeUint(0, 1)
                .storeCoins(toNano('0.1'))
                .storeUint(0, 1)
                .endCell()
        });

        let result = (await blockchain.getContract(wrapOwnerWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('1000'));

        result = (await blockchain.getContract(ownerWalletAddress)).get('get_wallet_data');
        if (result.stack[0].type != 'int') { throw ("Unexpected result type"); }
        expect(result.stack[0].value).toBe(toNano('998750'));
    });
});
