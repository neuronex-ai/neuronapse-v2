import { describe, expect, it } from "vitest";

import { feeFor, tariffPercentRate } from "../use-neurofinance-simulator";
import type { TariffRule } from "@/lib/neurofinance-types";

const cardRule = {
  percent_rate: 2.99,
  fixed_fee_cents: 49,
} as TariffRule;

describe("neurofinance simulator math", () => {
  it("calculates fixed plus percentual fee in cents", () => {
    expect(feeFor(cardRule, 15000)).toBe(498);
  });

  it("grosses up when fee is passed to the client", () => {
    const amount = 70000;
    const charged = Math.ceil((amount + 49) / (1 - tariffPercentRate(cardRule)));
    expect(charged).toBeGreaterThan(amount);
  });
});
