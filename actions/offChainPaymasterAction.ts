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

// Structure for PostOpRevertReason event
interface PostOpRevertReasonEvent {
  userOpHash: string;
  sender: string;
  nonce: bigint;
  revertReason: string;
}

// Logs JSON data, converting BigInt to string
const jsonStringify = (data: any): string => {
  return JSON.stringify(
    data,
    (_, value) => {
      return typeof value === "bigint" ? value.toString() : value;
    },
    2
  );
};

// Prints JSON data to console with a title
const printJson = (title: string, data: Object) => {
  console.log(`${title}: ${jsonStringify(data)}`);
};

// Parses handleOps function input from decoded data
const parseHandleOpsInput = (
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

// Decodes the PostOpRevertReason event from logs
const decodePostOpRevertReasonEvent = (
  logs: Log[]
): PostOpRevertReasonEvent | null => {
  const eventLog = logs.find((log) => log.topics[0] === postOpRevertReasonId);

  // Log warning if event not found
  if (!eventLog) {
    console.warn(`PostOpRevertReason event not found`);
    return null;
  }

  // Extract userOpHash from indexed topic
  const userOpHash = eventLog.topics[1];

  // Extract sender address from indexed topic
  const sender = getAddress("0x" + eventLog.topics[2].slice(26));

  // Extract nonce and revertReason from data
  const [nonce, revertReason] = AbiCoder.defaultAbiCoder().decode(
    ["uint256", "bytes"],
    eventLog.data
  );

  return {
    userOpHash,
    sender,
    nonce,
    revertReason,
  };
};

// Sends notifications to Discord webhook
const notifyDiscord = async (text: string, context: Context) => {
  const webhookLink = await context.secrets.get(
    "DISCORD_PAYMASTER_CHANNEL_WEBHOOK"
  );

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

// Do not change function name.
export const actionFn: ActionFn = async (context: Context, event: Event) => {
  //   console.log(`context: ${JSON.stringify(context, null, 2)}`);
  //   console.log(`event: ${JSON.stringify(event, null, 2)}`);

  // To access project's secret
  // let secret = await context.secrets.get('MY-SECRET')

  // To access project's storage
  // let value = await context.storage.getStr('MY-KEY')
  // await context.storage.putStr('MY-KEY', 'MY-VALUE')

  // Your logic goes here :)

  // Cast event to TransactionEvent type
  const transactionEvent = event as TransactionEvent;
  if (transactionEvent.hash === undefined) {
    return;
  }

  // Process transaction event and decode input
  const input = transactionEvent.input;
  const logs = transactionEvent.logs as Log[];

  const entryPointIface = new Interface(entryPointAbi);

  // Decode input data for handleOps function
  const decodedInput = entryPointIface.decodeFunctionData("handleOps", input);
  //   printJson("decodedInput", decodedInput);

  // Parse user operations and beneficiary
  const { ops } = parseHandleOpsInput(decodedInput);
  //   printJson("ops", ops);

  // Process each operation
  for (const op of ops) {
    // console.log(`paymasterAndData: ${op.paymasterAndData}`);

    // Decode paymasterAndData into structured fields
    const decodedPaymasterAndData = decodePaymasterAndDataStruct(
      op.paymasterAndData
    );

    if (!decodedPaymasterAndData) {
      console.warn(`Invalid paymasterAndData encountered`);
      continue;
    }
    printJson("Decoded Paymaster Data", decodedPaymasterAndData);

    if (decodedPaymasterAndData.mode !== PaymasterMode.ChargeInPostOp) {
      console.warn(`Paymaster mode is not ChargeInPostOp`);
      continue;
    }

    // If paymaster mode is ChargeInPostOp, fetch PostOpRevertReason event
    const postOpRevertReasonLog = decodePostOpRevertReasonEvent(logs);

    if (!postOpRevertReasonLog) {
      console.warn(`PostOpRevertReason event not found`);
      continue;
    }
    printJson("postOpRevertReasonLog", postOpRevertReasonLog);

    // Notify Discord with the post-operation revert reason
    await notifyDiscord(jsonStringify(postOpRevertReasonLog), context);
  }

  console.log(`Tenderly Web3 Action script completed`);
};
