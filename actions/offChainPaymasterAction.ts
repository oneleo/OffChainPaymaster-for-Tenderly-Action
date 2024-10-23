import {
  ActionFn,
  Context,
  Event,
  TransactionEvent,
  Log,
} from "@tenderly/actions";

import { getAddress, AbiCoder, hexlify, Interface, dataSlice } from "ethers";

import axios from "axios";

// Identifier for UserOperationEvent event
// = keccak256(abi.encodePacked("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"))
const userOperationEventId = hexlify(
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f"
);

// Identifier for PostOpRevertReason event
// = keccak256(abi.encodePacked("PostOpRevertReason(bytes32,address,uint256,bytes)"))
const postOpRevertReasonId =
  "0xf62676f440ff169a3a9afdbf812e89e7f95975ee8e5c31214ffdef631c5f4792";

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

// Append a value to a JSON array in Tenderly Web3 Action storage
const pushToStorage = async (context: Context, key: string, value: any) => {
  let jsonData = await context.storage.getJson(key);
  if (jsonData && Object.keys(jsonData).length === 0) {
    jsonData = [];
  }
  jsonData.push(JSON.parse(jsonStringify(value)));
  await context.storage.putJson(key, jsonData);
};

// Do not change function name.
export const actionFn: ActionFn = async (context: Context, event: Event) => {
  // To access project's secret
  // let secret = await context.secrets.get('MY-SECRET')

  // To access project's storage
  // let value = await context.storage.getStr('MY-KEY')
  // await context.storage.putStr('MY-KEY', 'MY-VALUE')

  // Your logic goes here :)

  // Configure storage: https://dashboard.tenderly.co/IraraChen/monitoring/actions/storage
  // Example: MONITORED_PAYMASTER_ADDRESSES=["0x44D6f8362c144A1217f24A11bE35f2c418B6cb20","0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82","0x4779C973b060c9cc1592b404cAd9CB5AFB0d4B52"]
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
  const discordWebhookLink = await context.secrets.get(
    "DISCORD_PAYMASTER_CHANNEL_WEBHOOK"
  );

  console.log(discordWebhookLink);

  // Cast event to TransactionEvent type
  const transactionEvent = event as TransactionEvent;
  if (transactionEvent.hash === undefined) {
    return;
  }

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

    if (userOpProcessedLog.chargeSuccessful) {
      await pushToStorage(context, "ChargeInPostOpSuccess", userOpProcessedLog);
    }

    if (!userOpProcessedLog.chargeSuccessful) {
      await pushToStorage(context, "ChargeInPostOpFail", userOpProcessedLog);

      const transactionHash = transactionEvent.hash;
      const sender = userOpProcessedLog.userOpSender;
      const text = `Transaction ${transactionHash} with UserOpProcessed() event and userOpHash ${
        userOpProcessedLog.userOpHash
      } failed to collect charges from sender ${sender} in ChargeInPostOp mode under OffChainPaymaster ${
        paymasters[userOpProcessedLog.userOpHash]
      }. Please check for any potential misconduct by sender.`;

      // Notify Discord with the post-operation revert
      await notifyDiscord(
        text,
        jsonStringify(userOpProcessedLog),
        discordWebhookLink
      );
    }
  }

  const postOpRevertReasonLogs = parsePostOpRevertReasonEvents({
    logs,
    filterUserOpHashes: userOpHashes,
  });

  printJson("postOpRevertReasonLogs", postOpRevertReasonLogs);

  // Process each user operation processed log
  for (const postOpRevertReasonLog of postOpRevertReasonLogs) {
    await pushToStorage(context, "PostOpRevertReason", postOpRevertReasonLog);

    const transactionHash = transactionEvent.hash;
    const sender = postOpRevertReasonLog.sender;
    const text = `Transaction ${transactionHash} with PostOpRevertReason() event and userOpHash ${
      postOpRevertReasonLog.userOpHash
    } was reverted for sender ${sender} during ChargeInPostOp mode under OffChainPaymaster ${
      paymasters[postOpRevertReasonLog.userOpHash]
    }. Please check for any potential misconduct by the sender.`;

    // Notify Discord with the post-operation revert
    await notifyDiscord(
      text,
      jsonStringify(postOpRevertReasonLog),
      discordWebhookLink
    );
  }

  console.log(`Tenderly Web3 Action script completed`);
};
