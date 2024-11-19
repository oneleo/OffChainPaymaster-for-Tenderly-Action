import {
  ActionFn,
  Context,
  Event,
  TransactionEvent,
  Log,
} from "@tenderly/actions";

import {
  toBigInt,
  getAddress,
  AbiCoder,
  hexlify,
  Interface,
  dataSlice,
  Contract,
  JsonRpcProvider,
} from "ethers";

import axios from "axios";

enum ChainId {
  Mainnet = 1,
  OptimismMainnet = 10,
  ArbitrumOne = 42161,
  BaseSepolia = 84532,
  ArbitrumSepolia = 421614,
  Sepolia = 11155111,
  OptimismSepolia = 11155420,
}

// Identifier for UserOperationEvent event
// = keccak256(abi.encodePacked("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"))
const userOperationEventId = hexlify(
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f"
);

// Identifier for PostOpRevertReason event
// = keccak256(abi.encodePacked("PostOpRevertReason(bytes32,address,uint256,bytes)"))
const postOpRevertReasonId = hexlify(
  "0xf62676f440ff169a3a9afdbf812e89e7f95975ee8e5c31214ffdef631c5f4792"
);

// Identifier for UserOpProcessed event
// = keccak256(abi.encodePacked("UserOpProcessed(bytes32,address,bytes32,uint8,uint256,address,uint256,address,bool)"))
const userOpProcessedId = hexlify(
  "0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9"
);

// Identifier for CanNotChargeFrom error
// = keccak256(abi.encodePacked("CanNotChargeFrom()"))
const canNotChargeFromId = hexlify(
  "0x58e450b14e49a4d03ffcd259c7ba1dfa2ce932e62dfac7782ca5d6cc50c1be10"
);

const canNotChargeFromSelector = dataSlice(canNotChargeFromId, 0, 4);

const entryPointInterface = new Interface([
  "error PostOpReverted(bytes returnData)",
]);

// Paymaster operation modes
enum PaymasterMode {
  Sponsor,
  ChargeInPostOp,
}

// Structure for UserOperationEvent event
export interface UserOpEventParams {
  userOpHash: string; // bytes32
  sender: string; // address
  paymaster: string; // address
  nonce: bigint; // uint256
  success: boolean; // bool
  actualGasCost: bigint; // uint256
  actualGasUsed: bigint; // uint256
}

// Structure for PostOpRevertReason event
export interface PostOpRevertReasonEventParams {
  userOpHash: string; // bytes32
  sender: string; // address
  nonce: bigint; // uint256
  revertReason: PostOpReverted; // bytes
}

export type PostOpReverted =
  | {
      error: string;
    }
  | {
      error: "CanNotChargeFrom";
    };

// Structure for UserOpProcessed event
export interface UserOpProcessedEventParams {
  userOpHash: string; // bytes32
  userOpSender: string; // address
  signerDataHash: string; // bytes32
  mode: PaymasterMode; // uint8
  actualGasCost: bigint; // uint256
  token: string; // address
  actualTokenCost: bigint; // uint256
  chargeFrom: string; // address
  chargeSuccessful: boolean; // bool
}

// Logs JSON data, converting BigInt to string
const jsonStringify = (data: any): string => {
  return JSON.stringify(
    data,
    (_, value) => {
      return typeof value === "bigint" ? `0x${value.toString(16)}` : value;
    },
    2
  );
};

// Prints JSON data to console with a title
export const printJson = (title: string, data: Object) => {
  console.log(`${title}: ${jsonStringify(data)}`);
};

// Decodes the UserOperationEvent event from logs
const parseUserOpEvent = (params: {
  logs: Log[];
  filterUserOpHashes?: string[];
  filterPaymasters?: string[];
}): UserOpEventParams[] => {
  const eventLogs = params.logs.filter(
    (log) => hexlify(log.topics[0]) === userOperationEventId
  );

  // Log warning if no matching events are found
  if (eventLogs.length === 0) {
    console.warn(`UserOperationEvent not found`);
    return [];
  }

  // Use reduce to accumulate valid events
  const decodedUserOpEvents = eventLogs.reduce<UserOpEventParams[]>(
    (userOps, eventLog) => {
      const userOpHash = hexlify(eventLog.topics[1]);

      // Skip if the userOpHash doesn't match the filter
      if (
        params.filterUserOpHashes &&
        !params.filterUserOpHashes.includes(userOpHash)
      ) {
        return userOps;
      }

      const sender = getAddress("0x" + eventLog.topics[2].slice(26));
      const paymaster = getAddress("0x" + eventLog.topics[3].slice(26));

      // Skip if the paymaster doesn't match the filter
      if (
        params.filterPaymasters &&
        !params.filterPaymasters.includes(paymaster)
      ) {
        return userOps;
      }

      const [nonce, success, actualGasCost, actualGasUsed] =
        AbiCoder.defaultAbiCoder().decode(
          ["uint256", "bool", "uint256", "uint256"],
          eventLog.data
        );

      // Push valid event to result
      userOps.push({
        userOpHash,
        sender,
        paymaster,
        nonce,
        success,
        actualGasCost,
        actualGasUsed,
      });

      return userOps;
    },
    []
  );

  if (decodedUserOpEvents.length === 0) {
    console.warn(`No matching UserOperationEvent found`);
  }

  return decodedUserOpEvents;
};

// Decodes the PostOpRevertReason event from logs
const parsePostOpRevertReasonEvents = (params: {
  logs: Log[];
  filterUserOpHashes?: string[];
}): PostOpRevertReasonEventParams[] => {
  const eventLogs = params.logs.filter(
    (log) => log.topics[0] === postOpRevertReasonId
  );

  // Log warning if event not found
  if (eventLogs.length === 0) {
    console.warn(`PostOpRevertReason event not found`);
    return [];
  }

  const decodedPostOpRevertReasonEvents = eventLogs.reduce<
    PostOpRevertReasonEventParams[]
  >((postOpRevertReasons, eventLog) => {
    // Extract userOpHash from indexed topic
    const userOpHash = eventLog.topics[1];

    // Skip if the userOpHash doesn't match the filter (if provided)
    if (
      params.filterUserOpHashes &&
      !params.filterUserOpHashes.includes(userOpHash)
    ) {
      return postOpRevertReasons;
    }

    // Extract sender address from indexed topic
    const sender = getAddress(dataSlice(eventLog.topics[2], 12));

    // Extract nonce and revertReason from data
    const [nonce, revertReason] = AbiCoder.defaultAbiCoder().decode(
      ["uint256", "bytes"],
      eventLog.data
    );

    const [returnData] = entryPointInterface.decodeErrorResult(
      "PostOpReverted",
      revertReason
    );

    let postOpReverted: PostOpReverted;

    switch (hexlify(returnData)) {
      case canNotChargeFromSelector: {
        postOpReverted = { error: "CanNotChargeFrom" };
        break;
      }
      default: {
        postOpReverted = { error: hexlify(returnData) };
        break;
      }
    }

    postOpRevertReasons.push({
      userOpHash,
      sender,
      nonce,
      revertReason: postOpReverted,
    });

    return postOpRevertReasons;
  }, []);

  if (decodedPostOpRevertReasonEvents.length === 0) {
    console.warn(`No PostOpRevertReason events matched the provided filter`);
  }

  return decodedPostOpRevertReasonEvents;
};

// Decodes the UserOpProcessed event from logs
const parseUserOpProcessedEvents = (params: {
  logs: Log[];
  filterUserOpHashes?: string[];
}): UserOpProcessedEventParams[] => {
  const eventLogs = params.logs.filter(
    (log) => hexlify(log.topics[0]) === userOpProcessedId
  );

  // Log warning if no matching events are found
  if (eventLogs.length === 0) {
    console.warn(`UserOpProcessed not found`);
    return [];
  }

  // Use reduce to accumulate valid events
  const decodedUserOpProcessedEvents = eventLogs.reduce<
    UserOpProcessedEventParams[]
  >((UserOpProcesseds, eventLog) => {
    const userOpHash = hexlify(eventLog.topics[1]);

    // Apply filters if provided
    if (
      params.filterUserOpHashes &&
      !params.filterUserOpHashes.includes(userOpHash)
    ) {
      return UserOpProcesseds;
    }

    const userOpSender = getAddress("0x" + eventLog.topics[2].slice(26));
    const signerDataHash = hexlify(eventLog.topics[3]);

    const [
      mode,
      actualGasCost,
      token,
      actualTokenCost,
      chargeFrom,
      chargeSuccessful,
    ] = AbiCoder.defaultAbiCoder().decode(
      ["uint8", "uint256", "address", "uint256", "address", "bool"],
      eventLog.data
    );

    // Push valid event to result
    UserOpProcesseds.push({
      userOpHash,
      userOpSender,
      signerDataHash,
      mode: Number(mode),
      actualGasCost,
      token: getAddress(token),
      actualTokenCost,
      chargeFrom: getAddress(chargeFrom),
      chargeSuccessful,
    });

    return UserOpProcesseds;
  }, []);

  if (decodedUserOpProcessedEvents.length === 0) {
    console.warn(`No matching UserOpProcessed events found`);
  }

  return decodedUserOpProcessedEvents;
};

// Gets network name based on chain ID
const getAlarmDepositAmount = (chainId: number): bigint => {
  const alarmDepositAmount: Record<number, number> = {
    [ChainId.Mainnet]: 0.0002,
    [ChainId.OptimismMainnet]: 0.02, // 0.02
    [ChainId.ArbitrumOne]: 0.2, // 0.2
    [ChainId.BaseSepolia]: 0.02,
    [ChainId.ArbitrumSepolia]: 0.2,
    [ChainId.Sepolia]: 0.0002,
    [ChainId.OptimismSepolia]: 0.02,
  };

  return BigInt((alarmDepositAmount[chainId] ?? 0.0002) * 10 ** 18);
};

// Formats the token balance with decimal precision
const formatTokenBalance = (balance: bigint, decimals: number): string => {
  const integerPart = balance / 10n ** BigInt(decimals);
  const decimalPart = balance % 10n ** BigInt(decimals);

  const formattedBalance = `${integerPart}.${decimalPart
    .toString()
    .padStart(Number(decimals), "0")}`;

  return formattedBalance;
};

// Gets network name based on chain ID
const getNetworkName = (chainId: number): string => {
  const baseNames: Record<number, string> = {
    [ChainId.Mainnet]: `Mainnet`,
    [ChainId.OptimismMainnet]: `Optimism`,
    [ChainId.ArbitrumOne]: `Arbitrum One`,
    [ChainId.BaseSepolia]: `Base Sepolia Testnet`,
    [ChainId.ArbitrumSepolia]: `Arbitrum Sepolia Testnet`,
    [ChainId.Sepolia]: `Sepolia Testnet`,
    [ChainId.OptimismSepolia]: `Optimism Sepolia Testnet`,
  };

  return baseNames[chainId] ?? `Unknown network`;
};

// Gets writeContract scan URL for a given chain ID and address
const getAddressScanUrl = (
  chainId: number,
  paymasterAddress: string
): string => {
  const baseUrls: Record<number, string> = {
    [ChainId.Mainnet]: `https://etherscan.io/address/`,
    [ChainId.OptimismMainnet]: `https://optimistic.etherscan.io/address/`,
    [ChainId.ArbitrumOne]: `https://arbiscan.io/address/`,
    [ChainId.BaseSepolia]: `https://sepolia.basescan.org/address/`,
    [ChainId.ArbitrumSepolia]: `https://sepolia.arbiscan.io/address/`,
    [ChainId.Sepolia]: `https://sepolia.etherscan.io/address/`,
    [ChainId.OptimismSepolia]: `https://sepolia-optimism.etherscan.io/address/`,
  };

  return baseUrls[chainId]
    ? `${baseUrls[chainId]}${paymasterAddress}#writeContract`
    : `Unknown`;
};

// Gets RPC URL based on chain ID and API key
const getRpcUrl = (chainId: number, alchemyApiKey: string): string | null => {
  const baseUrls: Record<number, string> = {
    [ChainId.Mainnet]: `https://eth-mainnet.g.alchemy.com/v2/`,
    [ChainId.OptimismMainnet]: `https://opt-mainnet.g.alchemy.com/v2/`,
    [ChainId.ArbitrumOne]: `https://arb-mainnet.g.alchemy.com/v2/`,
    [ChainId.BaseSepolia]: `https://base-sepolia.g.alchemy.com/v2/`,
    [ChainId.ArbitrumSepolia]: `https://arb-sepolia.g.alchemy.com/v2/`,
    [ChainId.Sepolia]: `https://eth-sepolia.g.alchemy.com/v2/`,
    [ChainId.OptimismSepolia]: `https://opt-sepolia.g.alchemy.com/v2/`,
  };

  return baseUrls[chainId] ? `${baseUrls[chainId]}${alchemyApiKey}` : null;
};

// Gets token balance and decimals using the Alchemy API
const getDeposit = async (
  chainId: number,
  paymasterAddress: string,
  alchemyApiKey?: string
): Promise<bigint | null> => {
  if (!alchemyApiKey) {
    console.error(`Alchemy api key not found`);
    return null;
  }

  const rpcUrl = getRpcUrl(chainId, alchemyApiKey);

  if (!rpcUrl) {
    console.error(`Can not get deposit: chainId not found`);
    return null;
  }

  const provider = new JsonRpcProvider(rpcUrl);

  const basePaymasterContract = new Contract(
    paymasterAddress,
    ["function getDeposit() public view returns (uint256)"],
    provider
  );

  try {
    const balance = toBigInt(await basePaymasterContract.getDeposit());

    return balance;
  } catch (error) {
    console.error(`Failed to get deposit: ${error}`);
    return null;
  }
};

// Sends notifications to Discord webhook
const notifyDiscord = async (
  text: string,
  content: string,
  webhookLink?: string
) => {
  if (!webhookLink) {
    console.error(`Discord webhook link not found`);
    return;
  }

  const discordText = `🐥 ${text}:\n${content}`;

  const data = {
    content: `${discordText}`,
  };

  const config = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  console.log(`Sending to Discord: ${discordText}`);

  try {
    // Send message to Discord
    const response = await axios.post(webhookLink, data, config);

    // Throw error if response status is not 204
    if (response.status !== 204) {
      throw new Error(
        `Failed to send Discord notification: ${response.statusText}`
      );
    }
  } catch (error) {
    console.error(`Error sending Discord notification: ${error}`);
  }
};

// Sends notifications to Slack webhook
const notifySlack = async (
  text: string,
  content: string,
  webhookLink?: string
) => {
  if (!webhookLink) {
    console.error(`Slack webhook link not found`);
    return;
  }

  const slackText = `🐥 ${text}:\n${content}`;

  const payload = {
    username: "webhookbot",
    text: slackText,
    icon_emoji: ":eye:",
  };

  console.log(`Sending to Slack: ${slackText}`);

  try {
    // Send message to Slack
    const response = await axios.post(webhookLink, payload);

    // Throw error if response status is not 204
    if (response.status !== 200) {
      throw new Error(
        `Failed to send Slack notification: ${response.statusText}`
      );
    }
  } catch (error) {
    console.error(`Error sending Slack notification: ${error}`);
  }
};

// Append a value to a JSON array in Tenderly Web3 Action storage
// const pushToStorage = async (context: Context, key: string, value: any) => {
//   let jsonData = await context.storage.getJson(key);
//   if (jsonData && Object.keys(jsonData).length === 0) {
//     jsonData = [];
//   }
//   jsonData.push(JSON.parse(jsonStringify(value)));
//   await context.storage.putJson(key, jsonData);
// };

// Do not change function name.
export const actionFn: ActionFn = async (context: Context, event: Event) => {
  // To access project's secret
  // let secret = await context.secrets.get('MY-SECRET')

  // To access project's storage
  // let value = await context.storage.getStr('MY-KEY')
  // await context.storage.putStr('MY-KEY', 'MY-VALUE')

  // Your logic goes here :)

  // Configure storage: https://dashboard.tenderly.co/IraraChen/monitoring/actions/storage
  // Example: MONITORED_PAYMASTER_ADDRESSES=["0xf67f1bB6817a138eD3C8f383a35B98D695f7E12c","0xbd7815594E6CeBdd2772A3676Ca29dB096f1Ec46","0x366359ADf61B97b011825bB7816F8c061027502f","0x1833bC4f1e2F33F3eE40e08fA55C26ce9C218Bcf","0xe3FA5B3378d30c9870Fda4249A0d6E4637d760B3"]
  const monitoredPaymasterAddresses: string[] = await context.storage.getJson(
    "MONITORED_PAYMASTER_ADDRESSES"
  );

  if (
    monitoredPaymasterAddresses &&
    Object.keys(monitoredPaymasterAddresses).length === 0
  ) {
    console.error(`Cannot get monitored paymaster address`);
    return;
  }

  // Normalize paymaster addresses
  monitoredPaymasterAddresses.forEach((paymaster, index, arr) => {
    arr[index] = getAddress(paymaster);
  });

  printJson("monitoredPaymasterAddress", monitoredPaymasterAddresses);

  // Configure secret: https://dashboard.tenderly.co/IraraChen/monitoring/actions/secrets
  // Example: DISCORD_PAYMASTER_CHANNEL_WEBHOOK=https://discord.com/api/webhooks/xxx/xxx
  // Example: SLACK_PAYMASTER_CHANNEL_WEBHOOK=https://hooks.slack.com/services/xxx/xxx/xxx
  const discordWebhookLink = await context.secrets.get(
    "DISCORD_PAYMASTER_CHANNEL_WEBHOOK"
  );
  console.log(`discordWebhookLink: ${discordWebhookLink}`);
  const slackWebhookLink = await context.secrets.get(
    "SLACK_PAYMASTER_CHANNEL_WEBHOOK"
  );
  console.log(`slackWebhookLink: ${slackWebhookLink}`);

  const alchemyApiKey = await context.secrets.get("ALCHEMY_API_KEY");
  console.log(`alchemyApiKey: ${alchemyApiKey}`);

  // Cast event to TransactionEvent type
  const transactionEvent = event as TransactionEvent;
  if (transactionEvent.hash === undefined) {
    return;
  }

  const chainId = parseInt(transactionEvent.network);
  console.log(`chainId: ${chainId}`);
  // Process transaction event
  const logs = transactionEvent.logs as Log[];

  // Fetch UserOperationEvent logs if paymaster is OffChainPaymaster
  const userOpEventLogs = parseUserOpEvent({
    logs,
    filterPaymasters: monitoredPaymasterAddresses,
  });

  if (userOpEventLogs.length === 0) {
    return;
  }

  // Extract user operation hashes and paymasters from event logs
  const userOpHashes: string[] = [];
  const paymasters: Record<string, string> = {};

  userOpEventLogs.forEach((userOp) => {
    userOpHashes.push(userOp.userOpHash);
    paymasters[userOp.userOpHash] = userOp.paymaster;
  });

  const userOpProcessedLogs = parseUserOpProcessedEvents({
    logs,
    filterUserOpHashes: userOpHashes,
  });

  printJson("userOpProcessedLogs", userOpProcessedLogs);

  // Process each user operation processed log
  for (const userOpProcessedLog of userOpProcessedLogs) {
    // Skip if not in ChargeInPostOp mode
    if (userOpProcessedLog.mode !== PaymasterMode.ChargeInPostOp) {
      continue;
    }

    const paymasterAddress = paymasters[userOpProcessedLog.userOpHash];

    const depositAmount = await getDeposit(
      chainId,
      paymasterAddress,
      alchemyApiKey
    );
    if (depositAmount === null) {
      const text = `(Tenderly) Rpc error: unable to retrieve OffChainPaymaster's deposit on ${chainId}, triggered by UserOpProcessed in: https://v2.jiffyscan.xyz/userOpHash/${userOpProcessedLog.userOpHash} .`;

      console.error(`text: ${text}`);

      // Notify Discord
      await notifyDiscord(text, "", discordWebhookLink);

      // Notify Slack
      await notifySlack(text, "", slackWebhookLink);
    }

    const alarmDepositAmount = getAlarmDepositAmount(chainId);
    const paymasterOnScan = getAddressScanUrl(chainId, paymasterAddress);
    const networkName = getNetworkName(chainId);

    console.log(`paymasterOnScan: ${paymasterOnScan}`);
    console.log(`depositAmount:\t${depositAmount}`);
    console.log(`alarmAmount:\t${alarmDepositAmount}`);

    if (depositAmount && depositAmount <= alarmDepositAmount) {
      const formatDepositAmount = formatTokenBalance(depositAmount, 18);
      const formatAlarmDepositAmount = formatTokenBalance(
        alarmDepositAmount,
        18
      );

      const text = `(Tenderly) OffChainPaymaster's deposit (${formatDepositAmount} ETH) on ${networkName} is fell below threshold (${formatAlarmDepositAmount} ETH), you can deposit here: ${paymasterOnScan} !`;

      console.warn(`text: ${text}`);

      // Notify Discord
      await notifyDiscord(text, "", discordWebhookLink);

      // Notify Slack
      await notifySlack(text, "", slackWebhookLink);
    }

    if (userOpProcessedLog.chargeSuccessful) {
      //   await pushToStorage(context, "ChargeInPostOpSuccess", userOpProcessedLog);
      await context.storage.putJson(
        "ChargeInPostOpSuccess",
        JSON.parse(jsonStringify(userOpProcessedLog))
      );
    }

    if (!userOpProcessedLog.chargeSuccessful) {
      //   await pushToStorage(context, "ChargeInPostOpFail", userOpProcessedLog);
      await context.storage.putJson(
        "ChargeInPostOpFail",
        JSON.parse(jsonStringify(userOpProcessedLog))
      );

      const transactionHash = transactionEvent.hash;
      const sender = userOpProcessedLog.userOpSender;
      const text = `(Tenderly Web3 Actions) Transaction https://v2.jiffyscan.xyz/bundle/${transactionHash} with UserOpProcessed() event and userOpHash https://v2.jiffyscan.xyz/userOpHash/${
        userOpProcessedLog.userOpHash
      } failed to collect charges from sender ${sender} in ChargeInPostOp mode under OffChainPaymaster ${
        paymasters[userOpProcessedLog.userOpHash]
      }. Please check for any potential misconduct by sender.`;

      // Notify Discord with the post-operation revert
      await notifyDiscord(text, "", discordWebhookLink);

      // Notify Slack with the post-operation revert
      await notifySlack(text, "", slackWebhookLink);
    }
  }

  const postOpRevertReasonLogs = parsePostOpRevertReasonEvents({
    logs,
    filterUserOpHashes: userOpHashes,
  });

  printJson("postOpRevertReasonLogs", postOpRevertReasonLogs);

  // Process each user operation processed log
  for (const postOpRevertReasonLog of postOpRevertReasonLogs) {
    // await pushToStorage(context, "PostOpRevertReason", postOpRevertReasonLog);
    await context.storage.putJson(
      "PostOpRevertReason",
      JSON.parse(jsonStringify(postOpRevertReasonLog))
    );

    const transactionHash = transactionEvent.hash;
    const sender = postOpRevertReasonLog.sender;
    const text = `(Tenderly Web3 Actions) Transaction https://jiffyscan.xyz/bundle/${transactionHash} with PostOpRevertReason() event and userOpHash https://jiffyscan.xyz/userOpHash/${
      postOpRevertReasonLog.userOpHash
    } was reverted for sender ${sender} during ChargeInPostOp mode under OffChainPaymaster ${
      paymasters[postOpRevertReasonLog.userOpHash]
    }. Please check for any potential misconduct by the sender.`;

    // Notify Discord with the post-operation revert
    await notifyDiscord(text, "", discordWebhookLink);

    // Notify Slack with the post-operation revert
    await notifySlack(text, "", slackWebhookLink);
  }

  console.log(`Tenderly Web3 Action script completed`);
};
