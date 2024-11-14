import { TestRuntime } from "@tenderly/actions-test";
import { expect } from "chai";

import {
  actionFn,
  UserOpProcessedEventParams,
  PostOpRevertReasonEventParams,
} from "../offChainPaymasterAction";
import { handleOpsPayload } from "./fixtures/handleOpsPayload";

describe("OffChainPaymasterActions", () => {
  it("New event", async () => {
    const testRuntime = new TestRuntime();

    const monitoredPaymasterAddress = [
      "0x44D6f8362c144A1217f24A11bE35f2c418B6cb20",
      "0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82",
      "0x4779C973b060c9cc1592b404cAd9CB5AFB0d4B52",
    ];
    const monitoredPaymasterAddressToStorage = JSON.stringify(
      monitoredPaymasterAddress
    );
    console.warn(
      `monitoredPaymasterAddressToStorage:【${monitoredPaymasterAddressToStorage}】`
    );

    await testRuntime.context.storage.putStr(
      "MONITORED_PAYMASTER_ADDRESSES",
      monitoredPaymasterAddressToStorage
    );

    testRuntime.context.secrets.put("DISCORD_PAYMASTER_CHANNEL_WEBHOOK", "");
    testRuntime.context.secrets.put("SLACK_PAYMASTER_CHANNEL_WEBHOOK", "");

    await testRuntime.execute(actionFn, handleOpsPayload);

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
});
