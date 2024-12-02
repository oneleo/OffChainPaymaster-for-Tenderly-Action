import { TestRuntime } from "@tenderly/actions-test";
import { expect } from "chai";

import {
  actionFn,
  UserOpProcessedEventParams,
  PostOpRevertReasonEventParams,
} from "../offChainPaymasterAction";
import {
  handleOpsBaseSepoliaPayload,
  handleOpsOptimismPayload,
  handleOpsArbitrumPayload,
} from "./fixtures/handleOpsPayload";

const monitoredPaymasterAddress = [
  "0xf67f1bB6817a138eD3C8f383a35B98D695f7E12c",
  "0xbd7815594E6CeBdd2772A3676Ca29dB096f1Ec46",
  "0x366359ADf61B97b011825bB7816F8c061027502f",
  "0x1833bC4f1e2F33F3eE40e08fA55C26ce9C218Bcf",
  "0xe3FA5B3378d30c9870Fda4249A0d6E4637d760B3",
  "0x44D6f8362c144A1217f24A11bE35f2c418B6cb20", // StupidPaymaster
  "0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82", // StupidPaymaster
  "0x4779C973b060c9cc1592b404cAd9CB5AFB0d4B52", // StupidPaymaster
];

describe("OffChainPaymasterActions", () => {
  let monitoredPaymasterAddressToStorage: string;
  let alchemyApiKey: string;
  let discordWebhookLink: string;
  let slackWebhookLink: string;

  before(() => {
    monitoredPaymasterAddressToStorage = JSON.stringify(
      monitoredPaymasterAddress
    );

    console.warn(
      `monitoredPaymasterAddressToStorage:【${monitoredPaymasterAddressToStorage}】`
    );

    alchemyApiKey = "";
    discordWebhookLink = "";
    slackWebhookLink = "";
  });

  it("handleOpsBaseSepoliaPayload", async () => {
    const testRuntime = new TestRuntime();

    await testRuntime.context.storage.putStr(
      "MONITORED_PAYMASTER_ADDRESSES",
      monitoredPaymasterAddressToStorage
    );

    testRuntime.context.secrets.put("ALCHEMY_API_KEY", alchemyApiKey);
    testRuntime.context.secrets.put(
      "DISCORD_PAYMASTER_CHANNEL_WEBHOOK",
      discordWebhookLink
    );
    testRuntime.context.secrets.put(
      "SLACK_PAYMASTER_CHANNEL_WEBHOOK",
      slackWebhookLink
    );

    await testRuntime.execute(actionFn, handleOpsBaseSepoliaPayload);

    const chargeInPostOpSuccess: UserOpProcessedEventParams =
      await testRuntime.context.storage.getJson("ChargeInPostOpSuccess");

    expect(chargeInPostOpSuccess.chargeSuccessful).to.eq(true);

    const chargeInPostOpFail: UserOpProcessedEventParams =
      await testRuntime.context.storage.getJson("ChargeInPostOpFail");

    expect(chargeInPostOpFail.chargeSuccessful).to.eq(false);

    const postOpRevertReason: PostOpRevertReasonEventParams =
      await testRuntime.context.storage.getJson("PostOpRevertReason");

    expect(postOpRevertReason.revertReason.error).to.eq("CanNotChargeFrom");
  });

  it("handleOpsOptimismPayload", async () => {
    const testRuntime = new TestRuntime();

    await testRuntime.context.storage.putStr(
      "MONITORED_PAYMASTER_ADDRESSES",
      monitoredPaymasterAddressToStorage
    );

    testRuntime.context.secrets.put("ALCHEMY_API_KEY", alchemyApiKey);
    testRuntime.context.secrets.put(
      "DISCORD_PAYMASTER_CHANNEL_WEBHOOK",
      discordWebhookLink
    );
    testRuntime.context.secrets.put(
      "SLACK_PAYMASTER_CHANNEL_WEBHOOK",
      slackWebhookLink
    );

    await testRuntime.execute(actionFn, handleOpsOptimismPayload);

    const chargeInPostOpSuccess: UserOpProcessedEventParams =
      await testRuntime.context.storage.getJson("ChargeInPostOpSuccess");

    expect(chargeInPostOpSuccess.chargeSuccessful).to.eq(true);
  });

  it("handleOpsArbitrumPayload", async () => {
    const testRuntime = new TestRuntime();

    await testRuntime.context.storage.putStr(
      "MONITORED_PAYMASTER_ADDRESSES",
      monitoredPaymasterAddressToStorage
    );

    testRuntime.context.secrets.put("ALCHEMY_API_KEY", alchemyApiKey);
    testRuntime.context.secrets.put(
      "DISCORD_PAYMASTER_CHANNEL_WEBHOOK",
      discordWebhookLink
    );
    testRuntime.context.secrets.put(
      "SLACK_PAYMASTER_CHANNEL_WEBHOOK",
      slackWebhookLink
    );

    await testRuntime.execute(actionFn, handleOpsArbitrumPayload);

    const chargeInPostOpSuccess: UserOpProcessedEventParams =
      await testRuntime.context.storage.getJson("ChargeInPostOpSuccess");

    expect(chargeInPostOpSuccess.chargeSuccessful).to.eq(true);
  });
});
