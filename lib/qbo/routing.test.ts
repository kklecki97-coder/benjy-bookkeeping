import { describe, it, expect } from "vitest";
import type { QboAccount } from "./accounts";
import {
  categoryNormalSide,
  resolveCategoryAccount,
  resolveBankAccount,
} from "./routing";

/** Build a fake QBO account and a name->account map keyed like accountMap(). */
function mk(name: string, type: string): QboAccount {
  return { Id: name.toLowerCase().replace(/\s+/g, "_"), Name: name, AccountType: type };
}
function mapOf(...accounts: QboAccount[]): Map<string, QboAccount> {
  const m = new Map<string, QboAccount>();
  for (const a of accounts) m.set(a.Name.toLowerCase().trim(), a);
  return m;
}

// A realistic slice of Benjy's chart of accounts (real names + types).
const ACCOUNTS = mapOf(
  mk("Checking - 2300", "Bank"),
  mk("AMEX 7-01001", "Credit Card"),
  mk("BankAmericard Platinum Plus Mastercard - 2797 - 1", "Credit Card"),
  mk("Utilities", "Expense"),
  mk("Vehicle expenses", "Other Expense"),
  mk("Cost of goods sold", "Cost of Goods Sold"),
  mk("Hana Sales", "Income"),
  mk("Shopify Sales", "Income"),
  mk("Sales Tax Payable", "Other Current Liabilities"),
  mk("Partner Equity", "Equity"),
  // alias targets
  mk("Software & apps", "Expense"),
  mk("Meals", "Expense"),
  mk("Janitorial Service", "Expense"),
  mk("New York State Tax Payable", "Other Current Liabilities"),
  mk("Uncategorized Expense", "Expense"),
);

describe("categoryNormalSide — debit/credit side from AccountType", () => {
  it("Income types credit the category line", () => {
    expect(categoryNormalSide("Income")).toBe("Credit");
    expect(categoryNormalSide("Other Income")).toBe("Credit");
  });
  it("Expense / COGS types debit the category line", () => {
    expect(categoryNormalSide("Expense")).toBe("Debit");
    expect(categoryNormalSide("Other Expense")).toBe("Debit");
    expect(categoryNormalSide("Cost of Goods Sold")).toBe("Debit");
  });
  it("Liability types credit the category line", () => {
    expect(categoryNormalSide("Other Current Liabilities")).toBe("Credit");
    expect(categoryNormalSide("Long Term Liabilities")).toBe("Credit");
  });
  it("Equity debits the category line", () => {
    expect(categoryNormalSide("Equity")).toBe("Debit");
  });
  it("returns null for types where direction is undefined", () => {
    expect(categoryNormalSide("Bank")).toBeNull();
    expect(categoryNormalSide("Accounts Receivable")).toBeNull();
    expect(categoryNormalSide("")).toBeNull();
  });
});

describe("resolveCategoryAccount", () => {
  it("matches an exact account name (case-insensitive)", () => {
    const r = resolveCategoryAccount("Utilities", ACCOUNTS);
    expect(r).toEqual({ ok: true, account: ACCOUNTS.get("utilities") });
  });

  it("resolves safe aliases to the client's actual account", () => {
    const cases: [string, string][] = [
      ["Software subscriptions", "Software & apps"],
      ["Meals & Entertainment", "Meals"],
      ["Janitorial", "Janitorial Service"],
      ["State Taxes", "New York State Tax Payable"],
      ["Uncategorized", "Uncategorized Expense"],
    ];
    for (const [category, target] of cases) {
      const r = resolveCategoryAccount(category, ACCOUNTS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.account.Name).toBe(target);
    }
  });

  it("fails LOUDLY with owner_decision for categories that need an accounting decision", () => {
    for (const category of [
      "Owner draw",
      "Owner draw — Kaela",
      "Equipment Loan Payment",
      "Seller Note Split",
    ]) {
      const r = resolveCategoryAccount(category, ACCOUNTS);
      expect(r).toEqual({ ok: false, reason: "owner_decision", category });
    }
  });

  it("fails with no_account for an unknown category", () => {
    const r = resolveCategoryAccount("Totally Made Up Category", ACCOUNTS);
    expect(r).toEqual({
      ok: false,
      reason: "no_account",
      category: "Totally Made Up Category",
    });
  });
});

describe("resolveBankAccount — source -> bank/card account", () => {
  it("routes known sources to the right account (kills the hardcoded 'checking' bug)", () => {
    expect(resolveBankAccount("amex", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("amex 7-01001"),
    });
    expect(resolveBankAccount("boa_checking", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("checking - 2300"),
    });
    expect(resolveBankAccount("boa_credit", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get(
        "bankamericard platinum plus mastercard - 2797 - 1",
      ),
    });
  });

  it("fails LOUDLY with owner_decision for channel sources (clearing model unconfirmed)", () => {
    for (const source of ["shopify", "hana", "honeybook"] as const) {
      expect(resolveBankAccount(source, ACCOUNTS)).toEqual({
        ok: false,
        reason: "owner_decision",
      });
    }
  });

  it("fails with no_account when the mapped account is missing from QBO", () => {
    const sparse = mapOf(mk("Utilities", "Expense")); // no bank/card accounts
    const r = resolveBankAccount("amex", sparse);
    expect(r).toEqual({
      ok: false,
      reason: "no_account",
      accountName: "AMEX 7-01001",
    });
  });
});
