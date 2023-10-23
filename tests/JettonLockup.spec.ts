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
    let authenticWalletCode: Cell;
    let owner: SandboxContract<TreasuryContract>
    let user: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let jettonLockup: SandboxContract<JettonLockup>;
    let jettonRoot: SandboxContract<JettonRoot>;
    let jettonLockupAuthenticWallet: SandboxContract<JettonWallet>;
    let jettonLockupPromiseWallet: SandboxContract<PromiseWallet>;
    let userJettonPromiseWallet: SandboxContract<PromiseWallet>;
    let userJettonWallet: SandboxContract<JettonWallet>;
    let user2JettonPromiseWallet: SandboxContract<PromiseWallet>;
    let user2JettonWallet: SandboxContract<JettonWallet>;
    let ownerJettonWallet: SandboxContract<JettonWallet>;
    let userJettonPromiseAuthenticWallet: SandboxContract<JettonWallet>;
    let user2JettonPromiseAuthenticWallet: SandboxContract<JettonWallet>;

    beforeAll(async () => {
        jettonLockupCode = await compile('JettonLockup');
        promiseWalletCode = await compile('PromiseWallet');
        authenticWalletCode = Cell.fromBoc(Buffer.from('b5ee9c7241021101000323000114ff00f4a413f4bcf2c80b0102016202030202cc0405001ba0f605da89a1f401f481f481a8610201d40607020120080900c30831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc2000113e910c1c2ebcb853600201200a0b0083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa401f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80c0201200d0e009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5402f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600f1000d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed5495eaedd7', 'hex'))[0]
    })

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = blockchainStartTime;

        owner = await blockchain.treasury('owner');
        user = await blockchain.treasury('user');
        user2 = await blockchain.treasury('user2');

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
        user2JettonWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(user2.address)));
        ownerJettonWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(owner.address)));

        const lockupConfig = {
            name: "Promise $JETTON",
            symbol: "pJETTON",
            image: "https://raw.githubusercontent.com/JetTon-Bot/JetTon/main/jetton-256.png",
            description: "Promise $JETTON of https://JetTon.Fund Platform",
            regulator: owner.address,
            walletCode: promiseWalletCode,
            authenticRoot: jettonRoot.address,
            authenticWalletCode: authenticWalletCode,
            startTime: blockchain.now! + 120,
            endTime: blockchain.now! + 1200,
            maxMonths: 12,
        };

        jettonLockup = blockchain.openContract(JettonLockup.createFromConfig(lockupConfig, jettonLockupCode));

        // await blockchain.setVerbosityForAddress(jettonLockup.address, {
        //     print: true,
        //     blockchainLogs: true,
        //     vmLogs: 'vm_logs',
        //     debugLogs: false,
        // })

        jettonLockupAuthenticWallet = blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(jettonLockup.address)));

        const lockupRootDeployResult = await jettonLockup.sendDeploy(owner.getSender(), jettonLockupAuthenticWallet.address);

        expect(lockupRootDeployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonLockup.address,
            success: true,
        });

        jettonLockupPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(jettonLockup.address)));
        userJettonPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(user.address)));
        userJettonPromiseAuthenticWallet = await blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(userJettonPromiseWallet.address)));
        user2JettonPromiseWallet = await blockchain.openContract(PromiseWallet.createFromAddress(await jettonLockup.getWalletAddress(user2.address)));
        user2JettonPromiseAuthenticWallet = await blockchain.openContract(JettonWallet.createFromAddress(await jettonRoot.getWalletAddress(user2JettonPromiseWallet.address)));

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

        /*

        console.log('owner: ' + owner.address);
        console.log('jettonRoot: ' + jettonRoot.address);
        console.log('ownerJettonWallet: ' + ownerJettonWallet.address);
        console.log('jettonLockupAuthenticWallet: ' + jettonLockupAuthenticWallet.address);
        console.log('jettonLockup: ' + jettonLockup.address);
        console.log('userJettonPromiseWallet: ' + userJettonPromiseWallet.address);

        */

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

            {
                // transfer jetton request
                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))
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

            {
                // transfer jetton request
                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+3*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+3*31*24*60*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))
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

            {
                // transfer jetton request
                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+6*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+6*31*24*60*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))
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

            {
                // transfer jetton request
                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+12*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+12*31*24*60*60*2);


            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));
            
            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))
        })

        it('should not lock for 13 months and vesting 13 months', async () => {
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
                exitCode: 1005
            })

            const dataAfterLock = await jettonLockup.getContractData()
            expect(dataAfterLock.totalSupply).toBe(BigInt(0))
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(0))
        })
    })

    describe('wallet tests', () => {
        it('should buy, and then shouldn`t withdraw tokens', async () => {
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
                to: jettonLockupAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockupAuthenticWallet.address, 
                to: userJettonPromiseAuthenticWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address, 
                to: userJettonPromiseWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: user.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            })

            expect(lockTx.transactions).toHaveTransaction({
                from: jettonLockup.address,
                to: userJettonPromiseWallet.address,
                success: true
            })

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 12*31*24*60*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 2*12*31*24*60*60);
            expect(lockedAmounts.unlockedAmount).toBe(BigInt(0));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))


            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
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

            {
                // transfer jetton request
                expect(lockTx.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmountsBefore.lockedAmounts[0].startUnlockTime + 100
            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountsAfter.unlockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts[0].lastReceived).toBe(blockchain.now)
            expect(lockedAmountAfterBurn.lockedAmounts[0].unlockedAmount).toBe(lockedAmountsAfter.unlockedAmount)
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance).toBe(BigInt(1e9 * 100)-lockedAmountsAfter.unlockedAmount)

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(lockedAmountsAfter.unlockedAmount)
            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(1e9 * 100 - Number(lockedAmountsAfter.unlockedAmount))
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

            const lockedAmountsBefore = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

            const dataAfterBuy = await jettonLockup.getContractData();
            expect(dataAfterBuy.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy.redeemedTokens).toBe(BigInt(1e9 * 100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmountsBefore.lockedAmounts[0].endUnlockTime + 1
            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountsAfter.unlockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance).toBe(BigInt(1e9 * 100)-lockedAmountsAfter.unlockedAmount)

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(lockedAmountsAfter.unlockedAmount)

            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(0)
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

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

            const authenticData1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData1.master).toEqualAddress(jettonRoot.address);
            expect(authenticData1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
            expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

            const authenticData2 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData2.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData2.master).toEqualAddress(jettonRoot.address);
            expect(authenticData2.balance).toEqual(BigInt(1e9 * 200));

            const promiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance2).toBe(BigInt(1e9*200))

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountsBefore2.lockedAmounts[0].lockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
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

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

            const authenticData1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData1.master).toEqualAddress(jettonRoot.address);
            expect(authenticData1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
            expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

            const authenticData2 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData2.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData2.master).toEqualAddress(jettonRoot.address);
            expect(authenticData2.balance).toEqual(BigInt(1e9 * 200));

            const promiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance2).toBe(BigInt(1e9*200))

            blockchain.now = lockedAmountsBefore2.lockedAmounts[0].endUnlockTime + 1

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount()

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountsAfter.unlockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts[0].lockedAmount).toBe(BigInt(100 * 1e9))
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance).toBe(BigInt(1e9 * 200) - lockedAmountsAfter.unlockedAmount)

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(lockedAmountsAfter.unlockedAmount)

            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(1e9 * 200 - Number(lockedAmountsAfter.unlockedAmount))
        })

        it('should buy with different lockup periods, and should transfer, 2 lockups has passed', async () => {
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

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now + 3*31*24*60*60);
            expect(lockedAmountsBefore1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now + 3*31*24*60*60*2);

            const dataAfterBuy1 = await jettonLockup.getContractData();
            expect(dataAfterBuy1.totalSupply).toBe(BigInt(1e9 * 100));
            expect(dataAfterBuy1.redeemedTokens).toBe(BigInt(1e9 * 100));

            const authenticData1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData1.master).toEqualAddress(jettonRoot.address);
            expect(authenticData1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmountsBefore2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsBefore2.lockedAmounts[1].lockedAmount).toBe(BigInt(1e9 * 100));
            expect(lockedAmountsBefore2.lockedAmounts[1].startUnlockTime).toBe(blockchain.now + 6*31*24*60*60);
            expect(lockedAmountsBefore2.lockedAmounts[1].endUnlockTime).toBe(blockchain.now + 6*31*24*60*60*2);

            const dataAfterBuy2 = await jettonLockup.getContractData();
            expect(dataAfterBuy2.totalSupply).toBe(BigInt(1e9 * 200));
            expect(dataAfterBuy2.redeemedTokens).toBe(BigInt(1e9 * 200));

            const authenticData2 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData2.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData2.master).toEqualAddress(jettonRoot.address);
            expect(authenticData2.balance).toEqual(BigInt(1e9 * 200));

            const promiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance2).toBe(BigInt(1e9*200))

            blockchain.now = lockedAmountsBefore2.lockedAmounts[1].endUnlockTime + 1

            const lockedAmountsAfter = await userJettonPromiseWallet.getUnlockedAmount()

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountsAfter.unlockedAmount
            );

            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance).toBe(BigInt(0))

            const userJettonBalance = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance).toBe(BigInt(200 * 1e9))

            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(0)
        })

        it('should swap 25% of the unlocked amount to authentic JetTon, then swap rest 75%', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            // temporary get_lockups_data() test
            const lockupsData = await userJettonPromiseWallet.getLockupsData();
            expect(lockupsData.tokensAvailable).toBe(BigInt(0));
            expect(lockupsData.tokensLocked).toBe(BigInt(1e9 * 100));
            expect(lockupsData.lastRecieved).toBe(Number(1698059348));

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const lockedAmountAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const burnTx1 = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountAfter.unlockedAmount / BigInt(4)
            );

            expect(burnTx1.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn1 = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn1.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn1.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance1 = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance1).toBe(lockedAmountAfter.unlockedAmount / BigInt(4) * BigInt(3))

            const userJettonBalance1 = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance1).toBe(lockedAmountAfter.unlockedAmount / BigInt(4))

            const lockupRootSupply1 = await jettonLockup.getSupply()
            expect(lockupRootSupply1).toBe(Number(lockedAmountAfter.unlockedAmount / BigInt(4) * BigInt(3)))

            

            const burnTx2 = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountAfter.unlockedAmount / BigInt(4) * BigInt(3)
            );

            expect(burnTx2.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn2 = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn2.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn2.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance2).toBe(BigInt(0))

            const userJettonBalance2 = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance2).toBe(lockedAmountAfter.unlockedAmount)

            const lockupRootSupply2 = await jettonLockup.getSupply()
            expect(lockupRootSupply2).toBe(0)
        })

        it('should lock for 5 mins, then withdraw, then lock again and then withdraw', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const lockedAmountAfter = await userJettonPromiseWallet.getUnlockedAmount();

            const burnTx1 = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountAfter.unlockedAmount
            );

            expect(burnTx1.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx1.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn1 = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn1.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn1.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance1 = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance1).toBe(BigInt(0))

            const userJettonBalance1 = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance1).toBe(lockedAmountAfter.unlockedAmount)

            const lockupRootSupply1 = await jettonLockup.getSupply()
            expect(lockupRootSupply1).toBe(0)


            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts2 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts2.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts2.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts2.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock2 = await jettonLockup.getContractData();
            expect(dataAfterLock2.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock2.redeemedTokens).toBe(BigInt(1e9*100*2));

            const authenticData2 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData2.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData2.master).toEqualAddress(jettonRoot.address);
            expect(authenticData2.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance2).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts2.lockedAmounts[0].endUnlockTime + 1

            const burnTx2 = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(3e8),
                jettonLockup.address,
                lockedAmountAfter.unlockedAmount
            );

            expect(burnTx2.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })


            const lockedAmountAfterBurn2 = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn2.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn2.unlockedAmount).toBe(BigInt(0))

            const userJettonPromiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(userJettonPromiseAuthenticBalance2).toBe(BigInt(0))

            const userJettonBalance2 = await userJettonWallet.getJettonBalance()
            expect(userJettonBalance2).toBe(lockedAmountAfter.unlockedAmount * BigInt(2))

            const lockupRootSupply2 = await jettonLockup.getSupply()
            expect(lockupRootSupply2).toBe(0)
        })
    })

    describe('transfer tests', () => {
        it('should transfer promise jetton between 2 users', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(0))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts).toStrictEqual([])
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(0))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(0))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(100*1e9))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user2LockedAmounts.lockedAmounts).toStrictEqual([])
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(1e9*100))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(1e9*100))
        })

        it('shouldn`t transfer promise jetton between 2 users, 1 user not owner', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user2.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user2.address,
                    to: userJettonPromiseWallet.address,
                    success: false,
                    exitCode: 73
                })
            }
        })

        it('shouldn`t transfer promise jetton between 2 users, not available jettons', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount * BigInt(2)
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: false,
                    exitCode: 47
                })
            }
        })

        it('shouldn`t transfer promise jetton between 2 users, not enough gas', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 2),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: false,
                    exitCode: 48
                })
            }
        })

        it('should transfer promise jetton between 2 users, with lockup, but lockup shouldn`t work', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                beginCell()
                .storeUint(blockchain.now + 5*60, 32)
                .storeUint(blockchain.now + 5*60*2, 32)
                .endCell(),
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(0))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts).toStrictEqual([])
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(0))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(0))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(100*1e9))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user2LockedAmounts.lockedAmounts).toStrictEqual([])
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(1e9*100))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(1e9*100))
        })

        it('should transfer promise jetton between 2 users, and seconds user can withdraw authentic', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }

            const lockedAmounts = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmounts.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmounts.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLock = await jettonLockup.getContractData();
            expect(dataAfterLock.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLock.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticData = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticData.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticData.master).toEqualAddress(jettonRoot.address);
            expect(authenticData.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalance).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmounts.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmounts.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(0))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts).toStrictEqual([])
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(0))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(0))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(100*1e9))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user2LockedAmounts.lockedAmounts).toStrictEqual([])
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(1e9*100))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(1e9*100))

            const burnTx = await user2JettonPromiseWallet.sendBurn(
                user2.getSender(),
                BigInt(1e8*3),
                user2.address,
                user2PromiseAuthenticBalance,
            )

            expect(burnTx.transactions).toHaveTransaction({
                from: user2.address,
                to: user2JettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseWallet.address,
                to: user2JettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseAuthenticWallet.address,
                to: user2JettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })

            const lockedAmountAfterBurn = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const user2JettonPromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance();
            expect(user2JettonPromiseAuthenticBalance).toBe(BigInt(0))

            const user2JettonBalance = await user2JettonWallet.getJettonBalance()
            expect(user2JettonBalance).toBe(BigInt(100*1e9))
            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(0)
            
        })

        it('1st user should buy, then receive jettons from 2nd user and withdraw all', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmountsUser1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLockUser1 = await jettonLockup.getContractData();
            expect(dataAfterLockUser1.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLockUser1.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticDataUser1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticDataUser1.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user2.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address, 
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser2 = await user2JettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser2.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser2.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmountsUser2.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLockUser2 = await jettonLockup.getContractData();
            expect(dataAfterLockUser2.totalSupply).toBe(BigInt(1e9*200));
            expect(dataAfterLockUser2.redeemedTokens).toBe(BigInt(1e9*200));

            const authenticDataUser2 = await user2JettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser2.jettonWallet).toEqualAddress(user2JettonPromiseAuthenticWallet.address);
            expect(authenticDataUser2.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser2.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser2 = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser2).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmountsUser2.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await userJettonPromiseWallet.sendTransfer(
                user.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user2.address,
                lockedAmountsUser1.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }
            
            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(0))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts).toStrictEqual([])
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(0))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(0))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(200*1e9))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(1e9*100))
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(1e9*200))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(1e9*200))

            const burnTx = await user2JettonPromiseWallet.sendBurn(
                user2.getSender(),
                BigInt(1e8*3),
                user2.address,
                user2PromiseAuthenticBalance,
            )

            {
            expect(burnTx.transactions).toHaveTransaction({
                from: user2.address,
                to: user2JettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseWallet.address,
                to: user2JettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseAuthenticWallet.address,
                to: user2JettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: user2JettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })
            }

            const lockedAmountAfterBurn = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const user2JettonPromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance();
            expect(user2JettonPromiseAuthenticBalance).toBe(BigInt(0))

            const user2JettonBalance = await user2JettonWallet.getJettonBalance()
            expect(user2JettonBalance).toBe(BigInt(200*1e9))
            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(0)
        })

        it('1st user should buy, then receive jettons from 2nd user and withdraw jettons from 2nd user', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+6*31*24*60*60);
            expect(lockedAmountsUser1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+6*31*24*60*60*2);

            const dataAfterLockUser1 = await jettonLockup.getContractData();
            expect(dataAfterLockUser1.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLockUser1.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticDataUser1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticDataUser1.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user2.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address, 
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser2 = await user2JettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser2.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser2.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmountsUser2.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLockUser2 = await jettonLockup.getContractData();
            expect(dataAfterLockUser2.totalSupply).toBe(BigInt(1e9*200));
            expect(dataAfterLockUser2.redeemedTokens).toBe(BigInt(1e9*200));

            const authenticDataUser2 = await user2JettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser2.jettonWallet).toEqualAddress(user2JettonPromiseAuthenticWallet.address);
            expect(authenticDataUser2.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser2.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser2 = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser2).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmountsUser2.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await user2JettonPromiseWallet.sendTransfer(
                user2.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user.address,
                lockedAmountsUser2.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user2.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }
            
            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(200*1e9))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(100*1e9))
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(200*1e9))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(200*1e9))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(0))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(0))
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(0))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(0))

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(1e8*3),
                user2.address,
                BigInt(1e9*100),
            )

            {
            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })
            }

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100))
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const user1JettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(user1JettonPromiseAuthenticBalance).toBe(BigInt(1e9*100))

            const user1JettonBalance = await userJettonWallet.getJettonBalance()
            expect(user1JettonBalance).toBe(BigInt(100*1e9))
            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(100*1e9)
        })

        it('1st user should buy, then receive jettons from 2nd user and withdraw jettons from 2nd user, and then from buy', async () => {
            const dataBeforeLock = await jettonLockup.getContractData()
            blockchain.now = dataBeforeLock.startTime

            const lockTx1 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(6, user.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx1.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx1.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address, 
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx1.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx1.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser1 = await userJettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser1.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser1.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+6*31*24*60*60);
            expect(lockedAmountsUser1.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+6*31*24*60*60*2);

            const dataAfterLockUser1 = await jettonLockup.getContractData();
            expect(dataAfterLockUser1.totalSupply).toBe(BigInt(1e9*100));
            expect(dataAfterLockUser1.redeemedTokens).toBe(BigInt(1e9*100));

            const authenticDataUser1 = await userJettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser1.jettonWallet).toEqualAddress(userJettonPromiseAuthenticWallet.address);
            expect(authenticDataUser1.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser1.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser1 = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser1).toBe(BigInt(1e9*100))

            const lockTx2 = await ownerJettonWallet.sendTransfer(
                owner.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e8 * 2),
                await jettonLockup.bodyForLock(5, user2.address),
                jettonLockup.address,
                BigInt(1e9 * 100)
            )

            {
            {
                // transfer jetton request
                expect(lockTx2.transactions).toHaveTransaction({
                    from: owner.address,
                    to: ownerJettonWallet.address,
                    success: true
                })

                // internal transfer from user to lockup authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: ownerJettonWallet.address,
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // transfer notification
                expect(lockTx2.transactions).toHaveTransaction({
                    op: 0x7362d09c,
                    from: jettonLockupAuthenticWallet.address, 
                    to: jettonLockup.address,
                    success: true
                })
            }

            {  
                // transfer request to user jetton promise wallet
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address, 
                    to: jettonLockupAuthenticWallet.address,
                    success: true
                })

                // internal transfer from lockup to promise authentic
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockupAuthenticWallet.address, 
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                // transfer notification (calculate userJettonPromiseAuthenticWallet address)
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address, 
                    to: user2JettonPromiseWallet.address,
                    success: true
                })
            }

            {
                // deploy and internal transfer
                expect(lockTx2.transactions).toHaveTransaction({
                    from: jettonLockup.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                }) 

                // transfer notification to user address
                expect(lockTx2.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2.address,
                    success: true
                })
            }
            }

            const lockedAmountsUser2 = await user2JettonPromiseWallet.getUnlockedAmount();
            expect(lockedAmountsUser2.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9*100))
            expect(lockedAmountsUser2.lockedAmounts[0].startUnlockTime).toBe(blockchain.now+5*60);
            expect(lockedAmountsUser2.lockedAmounts[0].endUnlockTime).toBe(blockchain.now+5*60*2);

            const dataAfterLockUser2 = await jettonLockup.getContractData();
            expect(dataAfterLockUser2.totalSupply).toBe(BigInt(1e9*200));
            expect(dataAfterLockUser2.redeemedTokens).toBe(BigInt(1e9*200));

            const authenticDataUser2 = await user2JettonPromiseWallet.getAuthenticData();
            expect(authenticDataUser2.jettonWallet).toEqualAddress(user2JettonPromiseAuthenticWallet.address);
            expect(authenticDataUser2.master).toEqualAddress(jettonRoot.address);
            expect(authenticDataUser2.balance).toEqual(BigInt(1e9 * 100));

            const promiseAuthenticBalanceUser2 = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(promiseAuthenticBalanceUser2).toBe(BigInt(1e9*100))

            blockchain.now = lockedAmountsUser2.lockedAmounts[0].endUnlockTime + 1

            const transferTx = await user2JettonPromiseWallet.sendTransfer(
                user2.getSender(),
                BigInt(1e8 * 3),
                BigInt(1e7 * 5),
                null,
                user.address,
                lockedAmountsUser2.lockedAmounts[0].lockedAmount
            )

            {
                expect(transferTx.transactions).toHaveTransaction({
                    from: user2.address,
                    to: user2JettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseWallet.address,
                    to: user.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseWallet.address,
                    to: user2JettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: user2JettonPromiseAuthenticWallet.address,
                    to: userJettonPromiseAuthenticWallet.address,
                    success: true
                })

                expect(transferTx.transactions).toHaveTransaction({
                    from: userJettonPromiseAuthenticWallet.address,
                    to: userJettonPromiseWallet.address,
                    success: true
                })
            }
            
            const user1AuthenticInfo = await userJettonPromiseWallet.getAuthenticData()
            expect(user1AuthenticInfo.balance).toBe(BigInt(200*1e9))
            const user1LockedAmounts = await userJettonPromiseWallet.getUnlockedAmount()
            expect(user1LockedAmounts.unlockedAmount).toBe(BigInt(0))
            expect(user1LockedAmounts.lockedAmounts[0].lockedAmount).toBe(BigInt(100*1e9))
            const user1PromiseBalance = await userJettonPromiseWallet.getJettonBalance()
            expect(user1PromiseBalance).toBe(BigInt(200*1e9))
            const user1PromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance()
            expect(user1PromiseAuthenticBalance).toBe(BigInt(200*1e9))
            

            const user2AuthenticInfo = await user2JettonPromiseWallet.getAuthenticData()
            expect(user2AuthenticInfo.balance).toBe(BigInt(0))
            const user2LockedAmounts = await user2JettonPromiseWallet.getUnlockedAmount()
            expect(user2LockedAmounts.unlockedAmount).toBe(BigInt(0))
            const user2PromiseBalance = await user2JettonPromiseWallet.getJettonBalance()
            expect(user2PromiseBalance).toBe(BigInt(0))
            const user2PromiseAuthenticBalance = await user2JettonPromiseAuthenticWallet.getJettonBalance()
            expect(user2PromiseAuthenticBalance).toBe(BigInt(0))

            const burnTx = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(1e8*3),
                user2.address,
                BigInt(1e9*100),
            )

            {
            expect(burnTx.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })
            }

            const lockedAmountAfterBurn = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn.lockedAmounts[0].lockedAmount).toBe(BigInt(1e9 * 100))
            expect(lockedAmountAfterBurn.unlockedAmount).toBe(BigInt(0))

            const user1JettonPromiseAuthenticBalance = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(user1JettonPromiseAuthenticBalance).toBe(BigInt(1e9*100))

            const user1JettonBalance = await userJettonWallet.getJettonBalance()
            expect(user1JettonBalance).toBe(BigInt(100*1e9))
            const lockupRootSupply = await jettonLockup.getSupply()
            expect(lockupRootSupply).toBe(100*1e9)

            blockchain.now = lockedAmountAfterBurn.lockedAmounts[0].endUnlockTime + 1

            const burnTx2 = await userJettonPromiseWallet.sendBurn(
                user.getSender(),
                BigInt(1e8*3),
                user2.address,
                BigInt(1e9*100),
            )

            {
            expect(burnTx2.transactions).toHaveTransaction({
                from: user.address,
                to: userJettonPromiseWallet.address,
                success: true,
            });

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: userJettonPromiseAuthenticWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseAuthenticWallet.address,
                to: userJettonWallet.address,
                success: true,
            })

            expect(burnTx2.transactions).toHaveTransaction({
                from: userJettonPromiseWallet.address,
                to: jettonLockup.address,
                success: true,
            })
            }

            const lockedAmountAfterBurn2 = await userJettonPromiseWallet.getUnlockedAmount()
            expect(lockedAmountAfterBurn2.lockedAmounts).toStrictEqual([])
            expect(lockedAmountAfterBurn2.unlockedAmount).toBe(BigInt(0))

            const user1JettonPromiseAuthenticBalance2 = await userJettonPromiseAuthenticWallet.getJettonBalance();
            expect(user1JettonPromiseAuthenticBalance2).toBe(BigInt(0))

            const user1JettonBalance2 = await userJettonWallet.getJettonBalance()
            expect(user1JettonBalance2).toBe(BigInt(100*1e9*2))
            const lockupRootSupply2 = await jettonLockup.getSupply()
            expect(lockupRootSupply2).toBe(0)
        })
    })
})

// 4k fuckin lines