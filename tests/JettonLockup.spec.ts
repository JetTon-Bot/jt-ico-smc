import { Blockchain, SandboxContract, TreasuryContract } from "@ton-community/sandbox";
import { Cell, beginCell } from "ton-core";
import { JettonLockup } from "../wrappers/JettonLockup";
import { JettonRoot } from "../wrappers/JettonRoot";
import { PromiseWallet } from "../wrappers/PromiseWallet";
import { compile } from "@ton-community/blueprint";
import '@ton-community/test-utils';
import { JettonWallet } from "../wrappers/JettonWallet";

describe('jetton lockup', () => {
    const blockchainStartTime = 100;


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
            name: "Wrapped Jetton",
            symbol: "WRAP",
            regulator: owner.address,
            walletCode: promiseWalletCode,
            startTime: blockchain.now! + 120,
            endTime: blockchain.now! + 1200,
            maxMonths: 12,
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
        expect(data.promiseJwall).toEqualAddress(jettonLockupPromiseWallet.address)
        expect(data.authenticJwall).toEqualAddress(jettonLockupAuthenticWallet.address)
    })

    describe('lock tokens with different lockup periods', () => {
        it('should lock for 5 mins and vesting 5 mins', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const dataAfterLock = await jettonLockup.getContractData()
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100))
        })

        it('should lock for 3 months and vesting 3 months', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(3, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const dataAfterLock = await jettonLockup.getContractData()
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+3*31*24*60*60*2);
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100))
        })

        it('should lock for 6 months and vesting 6 months', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const dataAfterLock = await jettonLockup.getContractData()
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+6*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+6*31*24*60*60*2);
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100))
        })

        it('should lock for 12 months and vesting 12 months', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(12, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const dataAfterLock = await jettonLockup.getContractData()
            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+12*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+12*31*24*60*60*2);
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100))
        })

        it('shouldn`t lock greater than 12 months', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(13, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: false,
                exitCode: 1010
            })

            const dataAfterLock = await jettonLockup.getContractData()
            expect(dataAfterLock.totalSupply).toBe(BigInt(0))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(0))
        })

        it('should not lock Jettons with wrong op', async () => {
            
            const dataBeforeLock = await jettonLockup.getContractData()

            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(3e8),
                BigInt(2e8),
                beginCell()
                    .storeUint(777, 32) // "Lucky" op :)
                    .storeUint(3, 4)
                    .storeAddress(user.address)
                .endCell(),
                jettonLockup.address,
                BigInt(1e11)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: false,
                exitCode: 0xffff
            })
        
        })

        it('should not lock Jettons with empty message body for lock', async () => {
            
            const dataBeforeLock = await jettonLockup.getContractData()

            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(3e8),
                BigInt(2e8),
                beginCell().endCell(),
                jettonLockup.address,
                BigInt(1e11)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: false,
                exitCode: 9 // Cell underflow
            })
        
        })


        it('shouldn`t lock, ico hasn`t started', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(12, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: false,
                exitCode: 1004,
            })


            const dataAfterLock = await jettonLockup.getContractData()
            expect(dataAfterLock.totalSupply).toBe(BigInt(0))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(0))
        })

        it('shouldn`t lock, ico has been ended', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.endTime + 1

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(12, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: false,
                exitCode: 1005,
            })


            const dataAfterLock = await jettonLockup.getContractData()
            expect(dataAfterLock.totalSupply).toBe(BigInt(0))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(0))
        })})

        describe('wallet tests', () => {
            it('should buy, and then shouldn`t transfer tokens', async () => {
                const dataBeforeLock = await jettonLockup.getContractData()
                blockchain.now = dataBeforeLock.startTime
                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterLock = await jettonLockup.getContractData();
                expect(dataAfterLock.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9 * 100));

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
                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy = await jettonLockup.getContractData();
                expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy = await jettonLockup.getContractData();
                expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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
                const lockTx1 = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy1 = await jettonLockup.getContractData();
                expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(6, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
                expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

                const dataAfterBuy2 = await jettonLockup.getContractData();
                expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
                expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

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
                const lockTx1 = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy1 = await jettonLockup.getContractData();
                expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(6, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
                expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

                const dataAfterBuy2 = await jettonLockup.getContractData();
                expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
                expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

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
                const lockTx1 = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy1 = await jettonLockup.getContractData();
                expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(6, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
                expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

                const dataAfterBuy2 = await jettonLockup.getContractData();
                expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
                expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

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
                const lockTx1 = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy1 = await jettonLockup.getContractData();
                expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(12, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 12*31*24*60*60);
                expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 12*31*24*60*60*2);

                const dataAfterBuy2 = await jettonLockup.getContractData();
                expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
                expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

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
                const lockTx1 = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })
                const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
                expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

                const dataAfterBuy1 = await jettonLockup.getContractData();
                expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(6, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
                expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
                expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

                const dataAfterBuy2 = await jettonLockup.getContractData();
                expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
                expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

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
                const dataBeforeLock = await jettonLockup.getContractData()

                blockchain.now = dataBeforeLock.startTime

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));

                const dataAfterBuy = await jettonLockup.getContractData();
                expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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
                expect(lockupInfoAfterSwap.totalSupply).toBe(BigInt(0))

                const userJettonBalance = await userJettonWallet.getJettonBalance()
                expect(userJettonBalance).toBe(BigInt(1e9 * 1100))

                const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
                expect(jettonAuthenticBalance).toBe(BigInt(0))
            }) 

            it('shouldn`t burn, time hasn`t passed', async () => {
                const lockupInfo = await jettonLockup.getContractData()
                blockchain.now = lockupInfo.startTime

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));

                const dataAfterBuy = await jettonLockup.getContractData();
                expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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

                const lockTx = await ownerJettonWallet.sendTransfer(
                    owner.getSender(),
                    BigInt(1e8 * 3),
                    BigInt(1e8 * 2),
                    await jettonLockup.bodyForLock(3, user.address),
                    jettonLockup.address,
                    BigInt(1e9 * 100)
                )

                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
    
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true,
                })

                const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
                expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));

                const dataAfterBuy = await jettonLockup.getContractData();
                expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
                expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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
        it('should swap', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(3, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

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
            expect(lockupInfoAfterSwap.totalSupply).toBe(BigInt(0))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(1e9 * 1100))

            const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalance).toBe(BigInt(0))

        })

        it('should not swap if insufficient unlocked amount', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(3, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

            blockchain.now = lockedAmountsAfter.lockedAmounts[0].endUnlockTime + 1
            const lockedAmountsAfterTime = await userJettonPromiseWallet.getUnlockedAmount();

            const swapTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                lockedAmountsAfterTime.unlockedAmount + BigInt(1),
            )

            expect(swapTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: false,
                exitCode: 47
            })

        })

        it('should swap 25% of the unlocked amount to authentic JetTon, then swap rest 75%', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(3e8),
                BigInt(2e8),
                await jettonLockup.bodyForLock(3, user.address),
                jettonLockup.address,
                BigInt(1e11)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e11));

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e11));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e11));

            blockchain.now = lockedAmountsAfter.lockedAmounts[0].endUnlockTime + 1
            const lockedAmountsAfterTime = await userJettonPromiseWallet.getUnlockedAmount();

            const swapTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                lockedAmountsAfterTime.unlockedAmount / BigInt(4),
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
            expect(lockupInfoAfterSwap.totalSupply).toBe(lockedAmountsAfterTime.unlockedAmount / BigInt(4) * BigInt(3))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(1e12 + 1e11 / 4))

            const jettonAuthenticBalance = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalance).toBe(BigInt(1e11 / 4 * 3))

            const swapTxSecond = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                lockedAmountsAfterTime.unlockedAmount / BigInt(4) * BigInt(3),
            )

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockupPromiseWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockupPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: userJettonWallet.address,
                to: user.address,
                success: true
            })

            const lockupInfoAfterSecondSwap = await jettonLockup.getContractData()
            expect(lockupInfoAfterSecondSwap.totalSupply).toBe(BigInt(0))

            const userJettonBalanceAfterSecondSwap = await userJettonWallet.getJettonBalance()
            expect(userJettonBalanceAfterSecondSwap).toBe(BigInt(1e9 * 1100))

            const jettonAuthenticBalanceAfterSecondSwap = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalanceAfterSecondSwap).toBe(BigInt(0))

        })

        it('should lock for 5 mins, then withdraw, then lock again and then withdraw', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(3e8),
                BigInt(2e8),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e11)
            )

            expect(lockTx.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfter.lockedAmounts[0].lockedAmount).toBe(BigInt(1e11));

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e11));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e11));

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

            const lockupInfoAfterSecondSwap = await jettonLockup.getContractData()
            expect(lockupInfoAfterSecondSwap.totalSupply).toBe(BigInt(0))

            const userJettonBalanceAfterSecondSwap = await userJettonWallet.getJettonBalance()
            expect(userJettonBalanceAfterSecondSwap).toBe(BigInt(1e9 * 1100))

            const jettonAuthenticBalanceAfterSecondSwap = await jettonLockupAuthenticWallet.getJettonBalance()
            expect(jettonAuthenticBalanceAfterSecondSwap).toBe(BigInt(0))

            const lockedAmountsAfterSwap = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfterSwap.unlockedAmount).toBe(BigInt(0))

            const lockTxSecond = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(3e8),
                BigInt(2e8),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e11)
            )

            expect(lockTxSecond.transactions).toHaveTransaction({
                from: owner.address,
                to: ownerJettonWallet.address,
                success: true
            })

            expect(lockTxSecond.transactions).toHaveTransaction({
                from: ownerJettonWallet.address,
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTxSecond.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: jettonLockup.address,
                success: true
            })

            expect(lockTxSecond.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            const lockedAmountsAfterSecond = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsAfterSecond.lockedAmounts[0].lockedAmount).toBe(BigInt(1e11));

            blockchain.now = lockedAmountsAfterSecond.lockedAmounts[0].endUnlockTime + 1
            const dataAfterBuySecond = await jettonLockup.getContractData();
            expect(dataAfterBuySecond.totalSupply).toBe(BigInt(1e11));
            expect(dataAfterBuySecond.redeemedTokens).toBe(BigInt(2e11));

            const swapTxSecond = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8),
                BigInt(1e8),
                null,
                jettonLockup.address,
                lockedAmountsAfterSecond.lockedAmounts[0].lockedAmount,
            )

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockupPromiseWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockupPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: jettonLockupAuthenticWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(swapTxSecond.transactions).toHaveTransaction({
                from: userJettonWallet.address,
                to: user.address,
                success: true
            }) 

            const lockedAmountsAfterSecondSwap = await userJettonPromiseWallet.getUnlockedAmount();
            console.log(lockedAmountsAfterSecondSwap)
            expect(lockedAmountsAfterSecondSwap.unlockedAmount).toBe(BigInt(0))


        })
        
        

    })

})