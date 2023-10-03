# JetTon-Promise

## Features
* Lockup with vesting
* Swap to authentic JetTon
* ICO with lockup period and vesting



## Project structure

-   `contracts/root` - implementation of root contract
- `contracts/wallet` - implementation of wallet contract
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`

# License
MIT



lockup period = 0
start_time = now() + lockup_period
end_time = now() + lockup_period * 2
end_time == start_time = true