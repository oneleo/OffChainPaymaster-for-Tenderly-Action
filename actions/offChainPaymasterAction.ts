import {
  ActionFn,
  Context,
  Event,
  TransactionEvent,
  Log,
} from "@tenderly/actions";

import {
  Interface,
  hexlify,
  getBytes,
  getAddress,
  AbiCoder,
  Result,
  type BytesLike,
} from "ethers";

import axios from "axios";

// Offsets for extracting fields from paymasterAndData
const PAYMASTER_VALIDATION_GAS_OFFSET = 20; // Address (bytes 0-20)
const PAYMASTER_POSTOP_GAS_OFFSET = 36; // Validation gas (bytes 20-36, uint256)
const PAYMASTER_DATA_OFFSET = 52; // PostOp gas (bytes 36-52, uint256)
const PAYMASTER_MODE_OFFSET = PAYMASTER_DATA_OFFSET; // Mode (byte 52, uint8)
const PAYMASTER_VALID_AFTER_OFFSET = PAYMASTER_MODE_OFFSET + 1; // Valid after (bytes 53-59, uint48)
const PAYMASTER_VALID_UNTIL_OFFSET = PAYMASTER_VALID_AFTER_OFFSET + 6; // Valid until (bytes 59-65, uint48)
const PAYMASTER_MAX_COST_ALLOWED_OFFSET = PAYMASTER_VALID_UNTIL_OFFSET + 6; // Max cost allowed (bytes 65-97, uint256)

// ABI for the handleOps function in the EntryPoint contract
const entryPointAbi = [
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)",
];

// Identifier for PostOpRevertReason event
// = keccak256(abi.encodePacked("PostOpRevertReason(bytes32,address,uint256,bytes)"))
const postOpRevertReasonId =
  "0xf62676f440ff169a3a9afdbf812e89e7f95975ee8e5c31214ffdef631c5f4792";

// Identifier for UserOperationEvent event
// = keccak256(abi.encodePacked("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"))
const userOperationEventId =
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";

// Identifier for UserOpProcessed event
// = keccak256(abi.encodePacked("UserOpProcessed(bytes32,address,bytes32,uint8,uint256,address,uint256,address,bool)"))
const userOpProcessedId =
  "0x4a7d89094dad8258a8c7f96c6cad9b077fe57305ac3e2da96478295d1b48c7d9";

// Paymaster operation modes
enum PaymasterMode {
  Sponsor,
  ChargeInPostOp,
}

// Interface for UserOperation input structure
interface PackedUserOperationInput {
  sender: string; // address
  nonce: bigint; // uint256
  initCode: string; // bytes
  callData: string; // bytes
  accountGasLimits: bigint; // bytes32 as BigNumber
  preVerificationGas: bigint; // uint256
  gasFees: bigint; // bytes32 as BigNumber
  paymasterAndData: string; // bytes
  signature: string; // bytes
}

// PaymasterData structure fields
interface PaymasterDataStruct {
  paymaster: string;
  validationGasLimit: bigint;
  postOpGasLimit: bigint;
  mode: PaymasterMode;
  validAfter: bigint;
  validUntil: bigint;
  maxCostAllowed: bigint;
}

// Structure for UserOperationEvent event
export interface UserOpEventParams {
  userOpHash: string;
  sender: string;
  paymaster: string;
  nonce: bigint;
  success: boolean;
  actualGasCost: bigint;
  actualGasUsed: bigint;
}

// Structure for PostOpRevertReason event
export interface PostOpRevertReasonEventParams {
  userOpHash: string;
  sender: string;
  nonce: bigint;
  revertReason: string;
}

// Structure for UserOpProcessed event
export interface UserOpProcessedEventParams {
  userOpHash: string;
  userOpSender: string;
  signerDataHash: string;
  mode: PaymasterMode;
  actualGasCost: bigint;
  token: string;
  actualTokenCost: bigint;
  chargeFrom: string;
  chargeSuccessful: boolean;
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

// Parses handleOps function input from decoded data
const decodeHandleOpsInput = (
  input: Result
): {
  ops: PackedUserOperationInput[];
  beneficiary: string;
} => {
  const opsData = input.getValue("ops");
  const beneficiary = input.getValue("beneficiary");

  // Ensure opsData is an array
  if (!Array.isArray(opsData)) {
    throw new Error("Invalid ops data format");
  }

  const ops: PackedUserOperationInput[] = opsData.map((opData: any) => {
    // Validate operation data
    if (!Array.isArray(opData) || opData.length !== 9) {
      throw new Error("Invalid PackedUserOperation data format");
    }

    return {
      sender: opData[0] as string,
      nonce: BigInt(opData[1]),
      initCode: opData[2] as string,
      callData: opData[3] as string,
      accountGasLimits: BigInt(opData[4]),
      preVerificationGas: BigInt(opData[5]),
      gasFees: BigInt(opData[6]),
      paymasterAndData: opData[7] as string,
      signature: opData[8] as string,
    };
  });

  return { ops, beneficiary };
};

// Decode paymasterAndData into structured fields
const decodePaymasterAndDataStruct = (
  paymasterAndData: BytesLike
): PaymasterDataStruct | null => {
  const data = getBytes(paymasterAndData);

  // Validate length
  if (data.length < PAYMASTER_MAX_COST_ALLOWED_OFFSET + 32) {
    console.error(`Invalid paymasterAndData length: ${data.length}`);
    return null;
  }

  try {
    // Extract paymaster address (bytes 0-20, address)
    const paymasterAddress = getAddress(
      hexlify(data.slice(0, PAYMASTER_VALIDATION_GAS_OFFSET))
    );

    // Extract validationGasLimit (bytes 20-36, uint256)
    const validationGasLimit = BigInt(
      hexlify(
        data.slice(PAYMASTER_VALIDATION_GAS_OFFSET, PAYMASTER_POSTOP_GAS_OFFSET)
      )
    );

    // Extract postOpGasLimit (bytes 36-52, uint256)
    const postOpGasLimit = BigInt(
      hexlify(data.slice(PAYMASTER_POSTOP_GAS_OFFSET, PAYMASTER_DATA_OFFSET))
    );

    // Extract PaymasterMode (bytes 52, uint8)
    const paymasterMode = data[PAYMASTER_MODE_OFFSET];

    // Extract validAfter (bytes 53-59, uint48)
    const validAfter = BigInt(
      hexlify(
        data.slice(
          PAYMASTER_VALID_AFTER_OFFSET,
          PAYMASTER_VALID_AFTER_OFFSET + 6
        )
      )
    );

    // Extract validUntil (bytes 59-65, uint48)
    const validUntil = BigInt(
      hexlify(
        data.slice(
          PAYMASTER_VALID_UNTIL_OFFSET,
          PAYMASTER_VALID_UNTIL_OFFSET + 6
        )
      )
    );

    // Extract maxCostAllowed (bytes 65-97, uint256)
    const maxCostAllowed = BigInt(
      hexlify(
        data.slice(
          PAYMASTER_MAX_COST_ALLOWED_OFFSET,
          PAYMASTER_MAX_COST_ALLOWED_OFFSET + 32
        )
      )
    );

    return {
      paymaster: paymasterAddress,
      validationGasLimit,
      postOpGasLimit,
      mode: paymasterMode,
      validAfter,
      validUntil,
      maxCostAllowed,
    };
  } catch (error) {
    console.error(`Failed to decode paymasterAndData: ${error}`);
    return null;
  }
};

// Decodes the UserOperationEvent event from logs
const parseUserOpEvent = (params: {
  logs: Log[];
  filterUserOpHashes?: string[];
  filterPaymasters?: string[];
}): UserOpEventParams[] => {
  const eventLogs = params.logs.filter(
    (log) => log.topics[0] === userOperationEventId
  );

  // Log warning if no matching events are found
  if (eventLogs.length === 0) {
    console.warn(`UserOperationEvent event not found`);
    return [];
  }

  // Use reduce to accumulate valid events
  const decodedUserOpEvents = eventLogs.reduce<UserOpEventParams[]>(
    (userOps, eventLog) => {
      // Extract userOpHash from indexed topic
      const userOpHash = eventLog.topics[1];

      // Skip if the userOpHash doesn't match the filter (if provided)
      if (
        params.filterUserOpHashes &&
        !params.filterUserOpHashes.includes(userOpHash)
      ) {
        return userOps;
      }

      // Extract sender and paymaster address from indexed topic
      const sender = getAddress("0x" + eventLog.topics[2].slice(26));

      const paymaster = getAddress("0x" + eventLog.topics[3].slice(26));

      // Skip if the paymaster doesn't match the filter (if provided)
      if (
        params.filterPaymasters &&
        !params.filterPaymasters.includes(paymaster)
      ) {
        return userOps;
      }

      // Extract nonce, success, actualGasCost and actualGasUsed from data
      const [nonce, success, actualGasCost, actualGasUsed] =
        AbiCoder.defaultAbiCoder().decode(
          ["uint256", "bool", "uint256", "uint256"],
          eventLog.data
        );

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
    console.warn(`No UserOperationEvent events matched the provided filter`);
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
    const sender = getAddress("0x" + eventLog.topics[2].slice(26));

    // Extract nonce and revertReason from data
    const [nonce, revertReason] = AbiCoder.defaultAbiCoder().decode(
      ["uint256", "bytes"],
      eventLog.data
    );

    postOpRevertReasons.push({
      userOpHash,
      sender,
      nonce,
      revertReason,
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
    (log) => log.topics[0] === userOpProcessedId
  );

  // Log warning if event not found
  if (eventLogs.length === 0) {
    console.warn(`UserOpProcessed event not found`);
    return [];
  }

  const decodedUserOpProcessedEvents = eventLogs.reduce<
    UserOpProcessedEventParams[]
  >((UserOpProcesseds, eventLog) => {
    // Extract userOpHash from indexed topic
    const userOpHash = eventLog.topics[1];

    // Skip if the userOpHash doesn't match the filter (if provided)
    if (
      params.filterUserOpHashes &&
      !params.filterUserOpHashes.includes(userOpHash)
    ) {
      return UserOpProcesseds;
    }

    // Extract userOpSender address from indexed topic
    const userOpSender = getAddress("0x" + eventLog.topics[2].slice(26));

    const signerDataHash = eventLog.topics[3];

    // Extract mode, actualGasCost, token and etc. from data
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

    UserOpProcesseds.push({
      userOpHash,
      userOpSender,
      signerDataHash,
      mode: Number(mode),
      actualGasCost,
      token,
      actualTokenCost,
      chargeFrom,
      chargeSuccessful,
    });

    return UserOpProcesseds;
  }, []);

  if (decodedUserOpProcessedEvents.length === 0) {
    console.warn(`No UserOpProcessed events matched the provided filter`);
  }

  return decodedUserOpProcessedEvents;
};

// Sends notifications to Discord webhook
const notifyDiscord = async (text: string, webhookLink: string) => {
  if (!webhookLink) {
    console.error(`Cannot find discord webhook link`);
    return;
  }

  const discordText = `🐥 ${text}`;

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
    printJson("response", response);
  } catch (error) {
    console.error(`Webhook post failed: ${jsonStringify(error)}`);
  }
};

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
  //

  // Set storage at: https://dashboard.tenderly.co/IraraChen/monitoring/actions/storage
  // Example:
  //   MONITORED_PAYMASTER_ADDRESS = [
  //     "0x44D6f8362c144A1217f24A11bE35f2c418B6cb20",
  //     "0x81d7a78C455730d0cdEcD5123793C9596ABBf53a",
  //   ];
  const monitoredPaymasterAddress: string[] = await context.storage.getJson(
    "MONITORED_PAYMASTER_ADDRESS"
  );

  console.log(
    `monitoredPaymasterAddress: ${JSON.stringify(
      monitoredPaymasterAddress,
      null,
      2
    )}`
  );

  if (
    monitoredPaymasterAddress &&
    Object.keys(monitoredPaymasterAddress).length === 0
  ) {
    console.error(`Cannot get monitored paymaster address`);
    return;
  }

  // Set secret at: https://dashboard.tenderly.co/IraraChen/monitoring/actions/secrets
  // Example:
  // DISCORD_PAYMASTER_CHANNEL_WEBHOOK=https://discord.com/api/webhooks/xxx/xxx
  const discordWebhookLink = await context.secrets.get(
    "DISCORD_PAYMASTER_CHANNEL_WEBHOOK"
  );
  console.log(discordWebhookLink);

  // Cast event to TransactionEvent type
  const transactionEvent = event as TransactionEvent;
  if (transactionEvent.hash === undefined) {
    return;
  }

  // Process transaction event and decode input
  const input = transactionEvent.input;
  const logs = transactionEvent.logs as Log[];

  // If paymaster is OffChainPaymaster, fetch UserOperationEvent event
  const userOpEventLogs = parseUserOpEvent({
    logs,
    filterPaymasters: monitoredPaymasterAddress,
  });
  if (userOpEventLogs.length === 0) {
    return;
  }

  const userOpHashes = userOpEventLogs.map((userOp) => userOp.userOpHash);

  const userOpProcessedLogs = parseUserOpProcessedEvents({
    logs,
    filterUserOpHashes: userOpHashes,
  });
  if (userOpProcessedLogs.length === 0) {
    return;
  }

  printJson("userOpProcessedLogs", userOpProcessedLogs);

  for (const userOpProcessedLog of userOpProcessedLogs) {
    if (userOpProcessedLog.mode !== PaymasterMode.ChargeInPostOp) {
      continue;
    }

    if (userOpProcessedLog.chargeSuccessful) {
      await pushToStorage(context, "ChargeInPostOpSuccess", userOpProcessedLog);
    }

    if (!userOpProcessedLog.chargeSuccessful) {
      await pushToStorage(context, "ChargeInPostOpFail", userOpProcessedLog);
      // Notify Discord with the post-operation revert reason
      await notifyDiscord(
        jsonStringify(userOpProcessedLog),
        discordWebhookLink
      );
    }
  }

  const entryPointIface = new Interface(entryPointAbi);

  // Decode input data for handleOps function
  const decodedInput = entryPointIface.decodeFunctionData("handleOps", input);
  //   printJson("decodedInput", decodedInput);

  // Parse user operations and beneficiary
  const { ops } = decodeHandleOpsInput(decodedInput);
  //   printJson("ops", ops);

  // Process each operation
  for (const op of ops) {
    // Decode paymasterAndData into structured fields
    const decodedPaymasterAndData = decodePaymasterAndDataStruct(
      op.paymasterAndData
    );

    // Invalid paymasterAndData encountered
    if (!decodedPaymasterAndData) {
      continue;
    }

    if (decodedPaymasterAndData.mode !== PaymasterMode.ChargeInPostOp) {
      console.warn(`Paymaster mode is not ChargeInPostOp`);
      continue;
    }

    // If paymaster mode is ChargeInPostOp, fetch PostOpRevertReason event
    const postOpRevertReasonLog = parsePostOpRevertReasonEvents({ logs });

    // PostOpRevertReason event not found
    if (!postOpRevertReasonLog) {
      continue;
    }
  }

  console.log(`Tenderly Web3 Action script completed`);
};
