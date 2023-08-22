import { Address, Cell, address } from "ton-core";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton-community/sandbox";
import { compile } from "@ton-community/blueprint";
import { JettonLockup, jettonLockupConfigToCell } from "../wrappers/JettonLockup";
import { PromiseWallet } from "../wrappers/PromiseWallet";
import { JettonRoot } from "../wrappers/JettonRoot";
import '@ton-community/test-utils';
import { JettonWallet } from "../wrappers/JettonWallet";

describe('Jetton Lockup', () => {
    
    const blockchainStartTime = 100;
    const vestingTime = 60*60;
    const prices = [
        {
            lockMonths: 3,
            price: BigInt(1e9),
        },
        {
            lockMonths: 6,
            price: BigInt(1e9 - 1e8)
        },
        {
            lockMonths: 12,
            price: BigInt(1e9-(1e8 * 2))
        }
    ]

    let blockchain: Blockchain;
    let jettonLockupCode: Cell;
    let promiseWalletCode: Cell;
    let owner: SandboxContract<TreasuryContract>
    let user: SandboxContract<TreasuryContract>;
    let jettonLockup: SandboxContract<JettonLockup>;
    let jettonRoot: SandboxContract<JettonRoot>;
    let jettonLockupAuthenticWallet: SandboxContract<JettonWallet>;
    let jettonLockupPromiseWallet: SandboxContract<PromiseWallet>;
    let userJettonPromiseWallet: SandboxContract<PromiseWallet>;
    let ownerJettonPromiseWallet: SandboxContract<PromiseWallet>;
    let userJettonWallet: SandboxContract<JettonWallet>;
    let ownerJettonWallet: SandboxContract<JettonWallet>;


    
    beforeAll(async () => {
        jettonLockupCode = await compile('JettonLockup');
        promiseWalletCode = await compile('PromiseWallet');
    })

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = blockchainStartTime;

        owner = await blockchain.treasury('owner');
        user = await blockchain.treasury('user');

        jettonRoot = blockchain.openContract(JettonRoot.createFromConfig({
            owner: owner.address,
        }));
        const rootDeployResult = await jettonRoot.sendDeploy(owner.getSender());
        expect(rootDeployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonRoot.address,
            success: true,
        });

        userJettonWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(user.address)));
        ownerJettonWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(owner.address)));

        const lockupConfig = {
            regulator: owner.address,
            walletCode: promiseWalletCode,
            startTime: blockchain.now! + 120,
            endTime: blockchain.now! + 240,
            vestingPeriod: vestingTime,
            prices: prices,
            availableTokens: BigInt(1e9 * 10000),
            minAmount: BigInt(1e9 * 100),
            maxAmount: BigInt(1e9 * 1000),
        };

        jettonLockup = blockchain.openContract(JettonLockup.createFromConfig(lockupConfig, jettonLockupCode));
        jettonLockupAuthenticWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(jettonLockup.address)));

        const lockupRootDeployResult = await jettonLockup.sendDeploy(owner.getSender(), jettonLockupAuthenticWallet.address);
        expect(lockupRootDeployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonLockup.address,
            success: true,
        });

        jettonLockupPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(jettonLockup.address)));
        userJettonPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(user.address)));
        ownerJettonPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(owner.address)));

        const txMintUserJettons = await jettonRoot.sendMintJettons(owner.getSender(), user.address, BigInt(1e9 * 1000));
        expect(txMintUserJettons.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonRoot.address,
            success: true
        });
        expect(txMintUserJettons.transactions).toHaveTransaction({
            from: jettonRoot.address,
            to: userJettonWallet.address,
            success: true
        });

        expect(await userJettonWallet.getJettonBalance()).toBe(BigInt(1e9 * 1000));

        const txMintOwnerJettons = await jettonRoot.sendMintJettons(owner.getSender(), owner.address, BigInt(1e9 * 1000));
        expect(txMintOwnerJettons.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonRoot.address,
            success: true
        });
        expect(txMintOwnerJettons.transactions).toHaveTransaction({
            from: jettonRoot.address,
            to: ownerJettonWallet.address,
            success: true
        });

        expect(await ownerJettonWallet.getJettonBalance()).toBe(BigInt(1e9 * 1000));

        const lockupInfo = await jettonLockup.getContractData()
        expect(lockupInfo.regulator).toEqualAddress(owner.address)
    })


    it('should deploy', async () => {
        const data = await jettonLockup.getContractData()
        expect(data.authenticJwall).toEqualAddress(jettonLockupAuthenticWallet.address)
        expect(data.promiseJwall).toEqualAddress(jettonLockupPromiseWallet.address)
    })

    describe('buy with different lockup periods', () => {
        it('should buy with lockup for 3 month', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));
        })
    
        it('should buy with lockup for 6 month', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 111));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9889));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));
        })
    
        it('should buy with lockup for 12 months', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                12
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 125));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 12*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 12*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 125));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9875));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));
        })
    })

    it('shouldn`t buy, min amount', async () => {
        const dataBeforeBuy = await jettonLockup.getContractData()
        blockchain.now = dataBeforeBuy.startTime
        const buyTx = await jettonLockup.sendBuyRequest(
            user.getSender(),
            BigInt(1e9 * 99),
            12
        );

        expect(buyTx.transactions).toHaveTransaction({
            from: user.address,
            to: jettonLockup.address,
            success: false,
            exitCode: 1002
        });

        const dataAfterBuy = await jettonLockup.getContractData();
        expect(dataAfterBuy.totalSupply).toBe(BigInt(0));
        expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 10000));
        expect(dataAfterBuy.receivedTokens).toBe(BigInt(0));
    })

    it('shouldn`t buy, max amount', async () => {
        const dataBeforeBuy = await jettonLockup.getContractData()
        blockchain.now = dataBeforeBuy.startTime
        const buyTx = await jettonLockup.sendBuyRequest(
            user.getSender(),
            BigInt(1e9 * 1001),
            12
        );

        expect(buyTx.transactions).toHaveTransaction({
            from: user.address,
            to: jettonLockup.address,
            success: false,
            exitCode: 1003
        });

        const dataAfterBuy = await jettonLockup.getContractData();
        expect(dataAfterBuy.totalSupply).toBe(BigInt(0));
        expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 10000));
        expect(dataAfterBuy.receivedTokens).toBe(BigInt(0));
    })

    it('shouldn`t buy, ico hasn`t started', async () => {
        const buyTx = await jettonLockup.sendBuyRequest(
            user.getSender(),
            BigInt(1e9 * 1000),
            12
        );

        expect(buyTx.transactions).toHaveTransaction({
            from: user.address,
            to: jettonLockup.address,
            success: false,
            exitCode: 1004
        });

        const dataAfterBuy = await jettonLockup.getContractData();
        expect(dataAfterBuy.totalSupply).toBe(BigInt(0));
        expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 10000));
        expect(dataAfterBuy.receivedTokens).toBe(BigInt(0));
    })

    it('shouldn`t buy, ico already ended', async () => {
        const dataBeforeBuy = await jettonLockup.getContractData()
        blockchain.now = dataBeforeBuy.endTime + 1
        const buyTx = await jettonLockup.sendBuyRequest(
            user.getSender(),
            BigInt(1e9 * 1000),
            12
        );

        expect(buyTx.transactions).toHaveTransaction({
            from: user.address,
            to: jettonLockup.address,
            success: false,
            exitCode: 1005
        });

        const dataAfterBuy = await jettonLockup.getContractData();
        expect(dataAfterBuy.totalSupply).toBe(BigInt(0));
        expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 10000));
        expect(dataAfterBuy.receivedTokens).toBe(BigInt(0));
    })

    it('shouldn`t buy, no available tokens for sell', async () => {
        const dataBeforeBuy = await jettonLockup.getContractData()
        blockchain.now = dataBeforeBuy.startTime

        for (let i = 1; i <= 10; i++) {
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 1000),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 1000 * i));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 10000 - 1e9 * 1000 * i));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 1000 * i));
        }
        const dataAfterBuy = await jettonLockup.getContractData();
        expect(dataAfterBuy.availableTokens).toBe(BigInt(0));

        const buyTx = await jettonLockup.sendBuyRequest(
            user.getSender(),
            BigInt(1e9 * 1000),
            3
        );

        expect(buyTx.transactions).toHaveTransaction({
            from: user.address,
            to: jettonLockup.address,
            success: false,
            exitCode: 1006
        });
    })

    describe('wallet tests', () => {
        it('should buy, and then shouldn`t transfer tokens', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                BigInt(1e9)
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: false,
                exitCode: 47
            });
        })

        it('should buy and then should transfer, unlock time has started', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmountsBefore.lockedAmounts[0].startUnlockTime + 100
            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                owner.address,
                lockedAmountsAfter.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })

            const ownerJPromiseBalance = await ownerJettonPromiseWallet.getJettonBalance()
            expect(ownerJPromiseBalance).toBe(lockedAmountsAfter.unlockedAmount)

            const lockedAmountAfterTransfer = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterTransfer.lockedAmounts[0].lastReceived).toBe(blockchain.now)
            expect(lockedAmountAfterTransfer.lockedAmounts[0].unlockedAmount).toBe(lockedAmountsAfter.unlockedAmount)
            expect(lockedAmountAfterTransfer.unlockedAmount).toBe(BigInt(0))
        })

        it('should buy and then should transfer all amount, vesting time has passed', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmountsBefore.lockedAmounts[0].endUnlockTime + 1
            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                owner.address,
                lockedAmountsAfter.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })

            const ownerJPromiseBalance = await ownerJettonPromiseWallet.getJettonBalance()
            expect(ownerJPromiseBalance).toBe(lockedAmountsAfter.lockedAmounts[0].lockedAmount)
        })

        it('should buy with different lockup periods, and shouldn`t transfer', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx1 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy1.receivedTokens).toBe(BigInt(1e9 * 100));

            const buyTx2 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 211));
            expect(dataAfterBuy2.availableTokens).toBe(BigInt(1e9 * 9789));
            expect(dataAfterBuy2.receivedTokens).toBe(BigInt(1e9 * 200));

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                BigInt(1e9)
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: false,
                exitCode: 47
            });
        })

        it('should buy with different lockup periods, 1 lockup has passed, and should transfer this tokens', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx1 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy1.receivedTokens).toBe(BigInt(1e9 * 100));

            const buyTx2 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 211));
            expect(dataAfterBuy2.availableTokens).toBe(BigInt(1e9 * 9789));
            expect(dataAfterBuy2.receivedTokens).toBe(BigInt(1e9 * 200));

            blockchain.now = lockedAmountsBefore2.lockedAmounts[0].startUnlockTime + 100

            const dataAfterTime = await userJettonPromiseWallet.getUnlockedAmount()

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                dataAfterTime.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })

            const dataAfterTransfer = await userJettonPromiseWallet.getUnlockedAmount()
            expect(dataAfterTransfer.lockedAmounts[0].lastReceived).toBe(blockchain.now)
            expect(dataAfterTransfer.lockedAmounts[1].lastReceived).toBe(0)
            expect(dataAfterTransfer.lockedAmounts[0].unlockedAmount).toBe(dataAfterTime.unlockedAmount)
            expect(dataAfterTransfer.lockedAmounts[1].unlockedAmount).toBe(BigInt(0))
        })

        it('should buy with different lockup periods, and should transfer 2 lockups has passed', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx1 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy1.receivedTokens).toBe(BigInt(1e9 * 100));

            const buyTx2 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 211));
            expect(dataAfterBuy2.availableTokens).toBe(BigInt(1e9 * 9789));
            expect(dataAfterBuy2.receivedTokens).toBe(BigInt(1e9 * 200));

            blockchain.now = lockedAmountsBefore2.lockedAmounts[1].startUnlockTime + 100

            const dataAfterTime = await userJettonPromiseWallet.getUnlockedAmount()

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                dataAfterTime.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })

            const dataAfterTransfer = await userJettonPromiseWallet.getUnlockedAmount()
            expect(dataAfterTransfer.lockedAmounts[0].lastReceived).toBe(blockchain.now)
            expect(dataAfterTransfer.lockedAmounts[0].unlockedAmount).toBe(dataAfterTime.unlockedAmount - dataAfterTime.lockedAmounts[0].lockedAmount)
        })

        it('should buy with different lockup periods, 1 lockup has passed and 1 vesting has passed', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx1 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy1.receivedTokens).toBe(BigInt(1e9 * 100));

            const buyTx2 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 211));
            expect(dataAfterBuy2.availableTokens).toBe(BigInt(1e9 * 9789));
            expect(dataAfterBuy2.receivedTokens).toBe(BigInt(1e9 * 200));

            blockchain.now = lockedAmountsBefore2.lockedAmounts[0].endUnlockTime + 100

            const dataAfterTime = await userJettonPromiseWallet.getUnlockedAmount()

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                dataAfterTime.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })

            const dataAfterTransfer = await userJettonPromiseWallet.getUnlockedAmount()
            expect(dataAfterTransfer.lockedAmounts[0].lastReceived).toBe(0)
            expect(dataAfterTransfer.lockedAmounts[0].unlockedAmount).toBe(BigInt(0))
        })

        it('should buy with differnet lockup periods, and should transfer 2 lockups and vesting has passed', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx1 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx1.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy1.receivedTokens).toBe(BigInt(1e9 * 100));

            const buyTx2 = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                6
            );
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx2.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 111));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 211));
            expect(dataAfterBuy2.availableTokens).toBe(BigInt(1e9 * 9789));
            expect(dataAfterBuy2.receivedTokens).toBe(BigInt(1e9 * 200));

            blockchain.now = lockedAmountsBefore2.lockedAmounts[1].endUnlockTime + 100

            const dataAfterTime = await userJettonPromiseWallet.getUnlockedAmount()

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1),
                null,
                owner.address,
                dataAfterTime.unlockedAmount,
            );

            expect(transferTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(transferTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: ownerJettonPromiseWallet.address,
                success: true,
            })

            expect(transferTx.transactions).toHaveTransaction({
                from: ownerJettonPromiseWallet.address,
                to: owner.address,
                success: true,
            })
        })

        it('should buy, and then swap to authentic', async () => {
            const topupTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                BigInt(1e9 * 1000)
            )

            expect(topupTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: jettonLockup.address,
                success: true
            })

            const lockupInfoAfterTopUp = await jettonLockup.getContractData()
            expect(lockupInfoAfterTopUp.availableAuthenticAmount).toBe(BigInt(1e9 * 1000))

            blockchain.now = lockupInfoAfterTopUp.startTime

            const buyTx = await jettonLockup.sendBuyRequest(user.getSender(), BigInt(1e9 * 100), 3);
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmountsAfter.lockedAmounts[0].endUnlockTime + 1
            const lockedAmountsAfterTime = await userJettonPromiseWallet.getUnlockedAmount();

            const swapTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                lockedAmountsAfterTime.unlockedAmount,
            )

            expect(swapTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockupPromiseWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockupPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: userJettonWallet.address,
                to: user.address,
                success: true
            })

            const lockupInfoAfterSwap = await jettonLockup.getContractData()
            expect(lockupInfoAfterSwap.availableAuthenticAmount).toBe(BigInt(1e9 * 900))
            expect(lockupInfoAfterSwap.totalSupply).toBe(BigInt(0))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(1e9 * 1100))

            const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalance).toBe(BigInt(1e9 * 900))
        }) 

        it('shouldn`t burn, time hasn`t passed', async () => {
            const lockupInfo = await jettonLockup.getContractData()
            blockchain.now = lockupInfo.startTime

            const buyTx = await jettonLockup.sendBuyRequest(user.getSender(), BigInt(1e9 * 100), 3);
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(1e8),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: false,
                exitCode: 47
            })
        })

        it('should burn, time has passed', async () => {
            const lockupInfo = await jettonLockup.getContractData()
            blockchain.now = lockupInfo.startTime

            const buyTx = await jettonLockup.sendBuyRequest(user.getSender(), BigInt(1e9 * 100), 3);
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmountsAfter.lockedAmounts[0].endUnlockTime + 1

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(1e8),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true
            })

            const dataAfterBurn = await jettonLockup.getContractData()
            expect(dataAfterBurn.totalSupply).toBe(BigInt(0))
        })
    })

    describe('swap tests', () => {
        it('should top up authentic jettons', async () => {
            const topupTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                BigInt(1e9 * 1000)
            )

            expect(topupTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: jettonLockup.address,
                success: true
            })

            const lockupInfoAfterTopUp = await jettonLockup.getContractData()
            expect(lockupInfoAfterTopUp.availableAuthenticAmount).toBe(BigInt(1e9 * 1000))
        })

        it('should swap, all is ok', async () => {
            const topupTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                BigInt(1e9 * 1000)
            )

            expect(topupTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(topupTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: jettonLockup.address,
                success: true
            })

            const lockupInfoAfterTopUp = await jettonLockup.getContractData()
            expect(lockupInfoAfterTopUp.availableAuthenticAmount).toBe(BigInt(1e9 * 1000))

            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const swapTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                BigInt(1e9 * 100),
            )

            expect(swapTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockupPromiseWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockupPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: userJettonWallet.address,
                to: user.address,
                success: true
            })

            const lockupInfoAfterSwap = await jettonLockup.getContractData()
            expect(lockupInfoAfterSwap.availableAuthenticAmount).toBe(BigInt(1e9 * 900))
            expect(lockupInfoAfterSwap.totalSupply).toBe(BigInt(0))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(1e9 * 1100))

            const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalance).toBe(BigInt(1e9 * 900))
        })

        it('shouldn`t swap, no available authentic', async () => {
            const dataBeforeBuy = await jettonLockup.getContractData()
            blockchain.now = dataBeforeBuy.startTime
            const buyTx = await jettonLockup.sendBuyRequest(
                user.getSender(),
                BigInt(1e9 * 100),
                3
            );
    
            expect(buyTx.transactions).toHaveTransaction({
                from: user.address,
                to: jettonLockup.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            });
    
            expect(buyTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: owner.address,
                success: true
            });
    
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60 + dataBeforeBuy.vestingPeriod);
    
            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.availableTokens).toBe(BigInt(1e9 * 9900));
            expect(dataAfterBuy.receivedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const swapTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                BigInt(1e9 * 100),
            )

            expect(swapTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockupPromiseWallet.address,
                success: true
            })

            expect(swapTx.transactions).toHaveTransaction({
                from: jettonLockupPromiseWallet.address,
                to: jettonLockup.address,
                success: false,
                exitCode: 1007
            })

            const lockupInfoAfterSwap = await jettonLockup.getContractData()
            expect(lockupInfoAfterSwap.availableAuthenticAmount).toBe(BigInt(0))
            expect(lockupInfoAfterSwap.totalSupply).toBe(BigInt(1e9 * 100))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(1e9 * 1000))

            const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalance).toBe(BigInt(0))
        })
    })
})
