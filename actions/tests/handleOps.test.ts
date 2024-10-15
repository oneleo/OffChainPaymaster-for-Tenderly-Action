import { TestRuntime } from "@tenderly/actions-test";
import { expect } from "chai";

import {
  actionFn,
  UserOpProcessedEventParams,
} from "../offChainPaymasterAction";
import { handleOpsPayload } from "./fixtures/handleOpsPayload";

describe("TicTacToeActions", () => {
  it("new game", async () => {
    const testRuntime = new TestRuntime();

    await testRuntime.context.storage.putJson("MONITORED_PAYMASTER_ADDRESS", [
      "0x44D6f8362c144A1217f24A11bE35f2c418B6cb20",
      "0xBDd6EB5C9A89f21B559f65C6b2bbeC265cE54C82",
    ]);

    testRuntime.context.secrets.put("DISCORD_PAYMASTER_CHANNEL_WEBHOOK", "");

    await testRuntime.execute(actionFn, handleOpsPayload);

    const chargeInPostOpSuccess: UserOpProcessedEventParams[] =
      await testRuntime.context.storage.getJson("ChargeInPostOpSuccess");

    expect(chargeInPostOpSuccess[0].chargeSuccessful).to.eq(true);

    const chargeInPostOpFail: UserOpProcessedEventParams[] =
      await testRuntime.context.storage.getJson("ChargeInPostOpFail");

    expect(chargeInPostOpFail[0].chargeSuccessful).to.eq(false);
  });
});
