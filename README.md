# OffChainPaymaster-for-Tenderly-Action

## Prerequisites

- Install Tenderly CLI

```shell
brew tap tenderly/tenderly && brew install tenderly
```

- Set your contract and target network ID to trigger

```shell
code tenderly.yaml

### Edit tenderly.yaml
# ...
            filters:
              - network: 84532
                # Transaction must come from the network with network ID
                status: success
                # Transaction must have succeeded
                to: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
                # Transaction must have been sent to EntryPoint contract
                contract:
                  address: 0x81d7a78C455730d0cdEcD5123793C9596ABBf53a
                  # transaction must have involved the OffChainPaymaster contract
# ...
###
```

## Usage

```shell
### Clone the project
git clone https://github.com/oneleo/OffChainPaymaster-for-Tenderly-Action.git
cd OffChainPaymaster-for-Tenderly-Action/

### Authenticate using your login token:
### You can get a token here: https://dashboard.tenderly.co/account/authorization
tenderly login

### Build your Action project:
tenderly actions build

### Deploy your Action to Tenderly Web3 Actions:
tenderly actions deploy
```
