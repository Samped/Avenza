#!/usr/bin/env node
/**
 * Turn a Foundry broadcast run-latest.json into a structured AVENZA deploy manifest.
 * Usage: node scripts/normalize-deployed-json.mjs <broadcast.json> <out.json> [chainId]
 */
import fs from "node:fs";
import path from "node:path";

const [, , src, dest, chainArg] = process.argv;
if (!src || !dest) {
  console.error("Usage: node scripts/normalize-deployed-json.mjs <broadcast.json> <out.json> [chainId]");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const chainId = Number(chainArg || raw.chain || 0);
const txs = raw.transactions || [];

const byContract = {};
for (const tx of txs) {
  if (tx.contractAddress && tx.transactionType === "CREATE" && tx.contractName) {
    byContract[tx.contractName] = tx.contractAddress;
  }
}

const manifest = {
  status: "deployed",
  chainId,
  nativeUsdc:
    chainId === 196
      ? "0xB6CEceAB302E2E4948951eE7843FC24E92933061"
      : "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3",
  tapeOutProcessor:
    process.env.TAPEOUT_PROCESSOR_ADDRESS ||
    (chainId === 196 ? "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF" : null),
  tapeOutCircuitId: Number(
    process.env.TAPEOUT_CIRCUIT_ID || process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID || 1,
  ),
  contracts: {
    EmergencyControl: byContract.EmergencyControl || null,
    OrganizationRegistry: byContract.OrganizationRegistry || null,
    VendorRegistry: byContract.VendorRegistry || null,
    PaymentPolicyRegistry: byContract.PaymentPolicyRegistry || null,
    ControlsRegistry: byContract.ControlsRegistry || null,
    PaymentAuthorization: byContract.PaymentAuthorization || null,
    PaymentRouter: byContract.PaymentRouter || null,
    BusinessTreasury: byContract.BusinessTreasury || null,
    AuditRegistry: byContract.AuditRegistry || null,
    MockTapeOutProcessor: byContract.MockTapeOutProcessor || null,
  },
  envMapping: {
    EMERGENCY_CONTROL_ADDRESS: "EmergencyControl",
    ORGANIZATION_REGISTRY_ADDRESS: "OrganizationRegistry",
    VENDOR_REGISTRY_ADDRESS: "VendorRegistry",
    PAYMENT_POLICY_REGISTRY_ADDRESS: "PaymentPolicyRegistry",
    CONTROLS_REGISTRY_ADDRESS: "ControlsRegistry",
    PAYMENT_AUTHORIZATION_ADDRESS: "PaymentAuthorization",
    PAYMENT_ROUTER_ADDRESS: "PaymentRouter",
    TREASURY_ADDRESS: "BusinessTreasury",
    AUDIT_REGISTRY_ADDRESS: "AuditRegistry",
  },
  broadcastSource: path.resolve(src),
  updatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${dest}`);
for (const [k, v] of Object.entries(manifest.contracts)) {
  if (v) console.log(`  ${k}=${v}`);
}
