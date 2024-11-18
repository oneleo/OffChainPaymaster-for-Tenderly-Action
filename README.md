# OffChainPaymaster-for-Tenderly-Action

## Tenderly Web3 Actions overview

![Tenderly Web3 Actions overview](images/tenderlyWeb3ActionsOverview.png "Tenderly Web3 Actions overview")

## Prerequisites

1. Please create an account on [Tenderly](https://dashboard.tenderly.co/), then build a project

![Create Tenderly project](images/createTenderlyProject.png "Create Tenderly project")

2. This action uses a Discord WebHook to handle OffChainPaymaster messages. Request a WebHook URL from the designated Discord channel

![Create Discord webhook url](images/createDiscordWebhookUrl.png "Create Discord webhook url")

3. In Tenderly’s Web3 Actions, add a secret "DISCORD_PAYMASTER_CHANNEL_WEBHOOK" and set the WebHook URL

![Add webhook to Actions secrets](images/addWebhookToActionsSecrets.png "Add webhook to Actions secrets")

4. Similarly, create a Slack webhook at [https://my.slack.com/services/new/incoming-webhook](https://my.slack.com/services/new/incoming-webhook) and store its URL in the `SLACK_PAYMASTER_CHANNEL_WEBHOOK` variable within Tenderly Web3 Secrets.

5. Create a Alchemy API key at [https://dashboard.alchemy.com/apps](https://dashboard.alchemy.com/apps) and store its key in the `ALCHEMY_API_KEY` variable within Tenderly Web3 Secrets.

6. Add a storage entry "MONITORED_PAYMASTER_ADDRESSES" as a string array, e.g., `["0xf67f1bB6817a138eD3C8f383a35B98D695f7E12c","0xbd7815594E6CeBdd2772A3676Ca29dB096f1Ec46","0x366359ADf61B97b011825bB7816F8c061027502f","0x1833bC4f1e2F33F3eE40e08fA55C26ce9C218Bcf","0xe3FA5B3378d30c9870Fda4249A0d6E4637d760B3"]`.

![Add paymaster addresses to actions storage](images/addPaymasterAddressesToActionsStorage.png "Add paymaster addresses to actions storage")

6. Install Tenderly CLI on local

```shell
brew tap tenderly/tenderly && brew install tenderly
```

## Deployment

1. Clone action from github

```shell
### Clone the project
git clone https://github.com/oneleo/OffChainPaymaster-for-Tenderly-Action.git
cd OffChainPaymaster-for-Tenderly-Action/
```

2. Set your Tenderly account and project name, format: [account name]/[project name]
   - In this case, account is `irarachen`, and project name is `monitoring`

```shell
code tenderly.yaml

### Edit tenderly.yaml
# ...
actions:
  irarachen/monitoring:
# ...
###
```

3. Set your network ID, target contract, and filter events using topics[0].
   - In this case, network ID = `84532` (Base Sepolia), target contract = EntryPoint (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`),
   - and filter for UserOpProcessed event (topics[0] = `0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9`) from OffChainPaymaster at `0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82`

```shell
code tenderly.yaml

### Edit tenderly.yaml
# ...
            filters:
              - network: 84532
                # Transaction must come from the network with network ID 84532
                status: success
                # Transaction must have succeeded
                to: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
                # Transaction must have been sent to EntryPoint contract
                logEmitted:
                  # Transaction must have emitted a log entry
                  contract:
                    address: 0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82
                    # coming from the OffChainPaymaster contract at this address
                  startsWith:
                    # and topics of the log entry must start with either one of these
                    - 0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9
# ...
###
```

4. Login to Tenderly and deploy action

```
### Authenticate using your login token:
### You can get a token here: https://dashboard.tenderly.co/account/authorization
tenderly login

### Build your Action project:
tenderly actions build

### Deploy your Action to Tenderly Web3 Actions:
tenderly actions deploy
```

5. In [offChainPaymasterAction.ts](https://github.com/oneleo/OffChainPaymaster-for-Tenderly-Action/blob/action-for-paymaster/actions/offChainPaymasterAction.ts#L320-L331), when OffChainPaymaster is in `ChargeInPostOp` mode and emits a `PostOpRevertReason` event, you'll receive event details on Discord.

## Test

1. Run Tests

```
### Navigate to the actions directory and execute the tests
(cd actions/ && npm run test)
```
