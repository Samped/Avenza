export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const riskFlagsComponents = [
  { name: "isNewVendor", type: "bool" },
  { name: "destinationChanged", type: "bool" },
  { name: "isDuplicate", type: "bool" },
  { name: "missingPo", type: "bool" },
  { name: "poMismatch", type: "bool" },
  { name: "unknownDestination", type: "bool" },
  { name: "supplierBlocked", type: "bool" },
  { name: "confidenceBps", type: "uint16" },
] as const;

export const paymentAuthorizationAbi = [
  {
    type: "function",
    name: "authorize",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "req",
        type: "tuple",
        components: [
          { name: "organizationId", type: "bytes32" },
          { name: "paymentId", type: "bytes32" },
          { name: "invoiceCommitment", type: "bytes32" },
          { name: "policyVersion", type: "uint64" },
          { name: "controlsVersion", type: "uint64" },
          { name: "amount", type: "uint256" },
          { name: "token", type: "address" },
          { name: "destination", type: "address" },
          { name: "vendorId", type: "bytes32" },
          { name: "vendorEligible", type: "bool" },
          { name: "approvalCount", type: "uint32" },
          { name: "requiredApprovals", type: "uint32" },
          { name: "circuitResult", type: "bytes32" },
          { name: "circuitInputs", type: "bytes" },
          { name: "risk", type: "tuple", components: riskFlagsComponents },
        ],
      },
    ],
    outputs: [{ name: "authorizationId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "setControlsRegistry",
    stateMutability: "nonpayable",
    inputs: [{ name: "controlsRegistry_", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setVendorRegistry",
    stateMutability: "nonpayable",
    inputs: [{ name: "vendorRegistry_", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "paymentAuthorizationId",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "isConsumed",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "PaymentAuthorized",
    inputs: [
      { name: "organizationId", type: "bytes32", indexed: true },
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "destination", type: "address", indexed: false },
    ],
  },
] as const;

export const businessTreasuryAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "available",
    stateMutability: "view",
    inputs: [{ name: "organizationId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "executeAuthorizedPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "paymentId", type: "bytes32" },
      { name: "authorizationId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "destination", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "PaymentExecuted",
    inputs: [
      { name: "organizationId", type: "bytes32", indexed: true },
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "destination", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: false },
    ],
  },
] as const;

export const tapeOutProcessorAbi = [
  {
    type: "function",
    name: "eval",
    stateMutability: "view",
    inputs: [
      { name: "circuitId", type: "uint256" },
      { name: "inputs", type: "bytes" },
    ],
    outputs: [{ type: "bytes" }],
  },
] as const;

export const organizationRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "admin", type: "address" },
      { name: "policyRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const vendorRegistryAbi = [
  {
    type: "function",
    name: "registerVendor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "vendorId", type: "bytes32" },
      { name: "destination", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setVerified",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vendorId", type: "bytes32" },
      { name: "verified", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setDestination",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vendorId", type: "bytes32" },
      { name: "destination", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vendors",
    stateMutability: "view",
    inputs: [{ name: "vendorId", type: "bytes32" }],
    outputs: [
      { name: "vendorId", type: "bytes32" },
      { name: "organizationId", type: "bytes32" },
      { name: "verified", type: "bool" },
      { name: "destination", type: "address" },
      { name: "destinationVersion", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "isEligible",
    stateMutability: "view",
    inputs: [
      { name: "vendorId", type: "bytes32" },
      { name: "destination", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const paymentPolicyRegistryAbi = [
  {
    type: "function",
    name: "registerPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "name", type: "string" },
      { name: "processor", type: "address" },
      { name: "circuitId", type: "uint256" },
      { name: "configHash", type: "bytes32" },
    ],
    outputs: [{ name: "version", type: "uint64" }],
  },
  {
    type: "function",
    name: "latestVersion",
    stateMutability: "view",
    inputs: [{ name: "organizationId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "version", type: "uint64" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "organizationId", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "version", type: "uint64" },
          { name: "processor", type: "address" },
          { name: "circuitId", type: "uint256" },
          { name: "configHash", type: "bytes32" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const controlsRegistryAbi = [
  {
    type: "function",
    name: "publishControls",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "autoApproveMaxUsdc", type: "uint256" },
      { name: "singleApproverMaxUsdc", type: "uint256" },
      { name: "dualControlAboveUsdc", type: "uint256" },
      { name: "minConfidenceBps", type: "uint16" },
      { name: "holdOnNewVendor", type: "bool" },
      { name: "holdOnDestinationChange", type: "bool" },
      { name: "holdOnDuplicate", type: "bool" },
      { name: "requirePurchaseOrder", type: "bool" },
      { name: "requirePoMatch", type: "bool" },
      { name: "holdOnUnknownDestination", type: "bool" },
      { name: "blockAutoApproveUntilAllowlisted", type: "bool" },
      { name: "configHash", type: "bytes32" },
    ],
    outputs: [{ name: "version", type: "uint64" }],
  },
  {
    type: "function",
    name: "latestVersion",
    stateMutability: "view",
    inputs: [{ name: "organizationId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "evaluate",
    stateMutability: "view",
    inputs: [
      { name: "organizationId", type: "bytes32" },
      { name: "amountUsdc", type: "uint256" },
      { name: "flags", type: "tuple", components: riskFlagsComponents },
    ],
    outputs: [
      {
        name: "result",
        type: "tuple",
        components: [
          { name: "decision", type: "uint8" },
          { name: "requiredApprovals", type: "uint32" },
          { name: "reasonCode", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

export const auditRegistryAbi = [
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recordId", type: "bytes32" },
      { name: "organizationId", type: "bytes32" },
      { name: "invoiceCommitment", type: "bytes32" },
      { name: "paymentId", type: "bytes32" },
      { name: "policyVersion", type: "uint64" },
      { name: "authorizationRef", type: "bytes32" },
      { name: "settlementRef", type: "bytes32" },
      { name: "eventType", type: "uint8" },
    ],
    outputs: [],
  },
] as const;
