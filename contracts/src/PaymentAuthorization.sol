// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";
import {OrganizationRegistry} from "./OrganizationRegistry.sol";
import {PaymentPolicyRegistry} from "./PaymentPolicyRegistry.sol";
import {ControlsRegistry} from "./ControlsRegistry.sol";
import {EmergencyControl} from "./EmergencyControl.sol";
import {VendorRegistry} from "./VendorRegistry.sol";

interface ITapeOutProcessor {
    function eval(uint256 circuitId, bytes calldata inputs) external returns (bytes memory);
}

/// @notice Relayer posts authorization after off-chain approvals + TapeOut + on-chain controls gate.
contract PaymentAuthorization is Ownable {
    struct AuthRequest {
        bytes32 organizationId;
        bytes32 paymentId;
        bytes32 invoiceCommitment;
        uint64 policyVersion;
        uint64 controlsVersion;
        uint256 amount;
        address token;
        address destination;
        bytes32 vendorId;
        bool vendorEligible;
        uint32 approvalCount;
        uint32 requiredApprovals;
        bytes32 circuitResult;
        bytes circuitInputs;
        ControlsRegistry.RiskFlags risk;
    }

    struct Authorization {
        bytes32 authorizationId;
        bytes32 paymentId;
        bytes32 organizationId;
        uint256 amount;
        address token;
        address destination;
        bool consumed;
        uint64 createdAt;
    }

    OrganizationRegistry public immutable orgRegistry;
    PaymentPolicyRegistry public immutable policyRegistry;
    ControlsRegistry public controlsRegistry;
    VendorRegistry public vendorRegistry;
    EmergencyControl public immutable emergency;
    address public relayer;
    address public treasury;
    uint256 public maxPaymentAmount;

    mapping(bytes32 => bool) public paymentSeen;
    mapping(bytes32 => Authorization) public authorizations;
    mapping(bytes32 => bytes32) public paymentAuthorizationId;

    event RelayerUpdated(address indexed relayer);
    event TreasuryUpdated(address indexed treasury);
    event ControlsRegistryUpdated(address indexed controlsRegistry);
    event VendorRegistryUpdated(address indexed vendorRegistry);
    event MaxPaymentUpdated(uint256 amount);
    event PaymentAuthorized(
        bytes32 indexed organizationId,
        bytes32 indexed paymentId,
        bytes32 authorizationId,
        uint256 amount,
        address destination
    );
    event AuthorizationConsumed(bytes32 indexed authorizationId, bytes32 indexed paymentId);

    constructor(
        address initialOwner,
        address organizationRegistry_,
        address policyRegistry_,
        address emergency_,
        address relayer_,
        uint256 maxPaymentAmount_
    ) Ownable(initialOwner) {
        orgRegistry = OrganizationRegistry(organizationRegistry_);
        policyRegistry = PaymentPolicyRegistry(policyRegistry_);
        emergency = EmergencyControl(emergency_);
        relayer = relayer_;
        maxPaymentAmount = maxPaymentAmount_;
    }

    function setRelayer(address relayer_) external onlyOwner {
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setControlsRegistry(address controlsRegistry_) external onlyOwner {
        controlsRegistry = ControlsRegistry(controlsRegistry_);
        emit ControlsRegistryUpdated(controlsRegistry_);
    }

    function setVendorRegistry(address vendorRegistry_) external onlyOwner {
        vendorRegistry = VendorRegistry(vendorRegistry_);
        emit VendorRegistryUpdated(vendorRegistry_);
    }

    function setMaxPaymentAmount(uint256 amount) external onlyOwner {
        maxPaymentAmount = amount;
        emit MaxPaymentUpdated(amount);
    }

    function authorize(AuthRequest calldata req) external returns (bytes32 authorizationId) {
        require(msg.sender == relayer || msg.sender == owner(), "unauthorized");
        emergency.requireOperational(req.organizationId);
        require(orgRegistry.isActive(req.organizationId), "org inactive");
        require(!paymentSeen[req.paymentId], "replay");
        require(req.amount > 0 && req.amount <= maxPaymentAmount, "amount");
        require(req.destination != address(0), "destination");
        require(req.circuitResult != bytes32(0), "circuit");

        // Prefer on-chain VendorRegistry when wired; otherwise trust API-supplied flag.
        if (address(vendorRegistry) != address(0)) {
            require(req.vendorId != bytes32(0), "vendor id");
            require(vendorRegistry.isEligible(req.vendorId, req.destination), "vendor");
        } else {
            require(req.vendorEligible, "vendor");
        }

        PaymentPolicyRegistry.Policy memory policy =
            policyRegistry.getPolicy(req.organizationId, req.policyVersion);
        require(policy.version == req.policyVersion, "policy version");
        require(policy.configHash != bytes32(0), "policy missing");
        require(policy.active, "policy inactive");
        // Mainnet-safe: never authorize against a policy with no TapeOut processor.
        require(policy.processor != address(0), "processor required");

        // On-chain controls gate (required when ControlsRegistry is wired).
        if (address(controlsRegistry) != address(0)) {
            uint64 latestControls = controlsRegistry.latestVersion(req.organizationId);
            require(latestControls > 0, "no controls");
            require(
                req.controlsVersion == 0 || req.controlsVersion == latestControls, "controls version"
            );
            ControlsRegistry.Evaluation memory ev =
                controlsRegistry.evaluate(req.organizationId, req.amount, req.risk);
            require(ev.decision != 3, "controls hold"); // DECISION_HOLD
            require(req.approvalCount >= ev.requiredApprovals, "approvals");
            // Caller-supplied requiredApprovals must not understate the gate.
            require(req.requiredApprovals >= ev.requiredApprovals, "required approvals");
        } else {
            require(req.approvalCount >= req.requiredApprovals, "approvals");
        }

        require(policy.circuitId != 0 || req.circuitInputs.length > 0, "circuit id");
        bytes memory tapeOutOut =
            ITapeOutProcessor(policy.processor).eval(policy.circuitId, req.circuitInputs);
        require(tapeOutOut.length > 0, "tapeout empty");
        require((uint8(tapeOutOut[0]) & uint8(1)) == 1, "tapeout fail");

        paymentSeen[req.paymentId] = true;
        authorizationId = keccak256(
            abi.encode(
                req.organizationId,
                req.paymentId,
                req.invoiceCommitment,
                req.policyVersion,
                req.amount,
                req.token,
                req.destination,
                block.chainid
            )
        );

        authorizations[authorizationId] = Authorization({
            authorizationId: authorizationId,
            paymentId: req.paymentId,
            organizationId: req.organizationId,
            amount: req.amount,
            token: req.token,
            destination: req.destination,
            consumed: false,
            createdAt: uint64(block.timestamp)
        });
        paymentAuthorizationId[req.paymentId] = authorizationId;

        emit PaymentAuthorized(
            req.organizationId, req.paymentId, authorizationId, req.amount, req.destination
        );
    }

    /// @notice Only the treasury may consume an authorization (prevents burn-without-pay).
    function consume(bytes32 authorizationId, bytes32 paymentId, uint256 amount, address token, address destination)
        external
        returns (bool)
    {
        require(msg.sender == treasury, "unauthorized");
        Authorization storage auth = authorizations[authorizationId];
        require(auth.createdAt != 0, "unknown auth");
        require(!auth.consumed, "consumed");
        require(auth.paymentId == paymentId, "payment mismatch");
        require(auth.amount == amount, "amount mismatch");
        require(auth.token == token, "token mismatch");
        require(auth.destination == destination, "dest mismatch");
        require(block.timestamp <= auth.createdAt + 1 days, "expired");
        auth.consumed = true;
        emit AuthorizationConsumed(authorizationId, paymentId);
        return true;
    }

    function isConsumed(bytes32 paymentId) external view returns (bool) {
        bytes32 id = paymentAuthorizationId[paymentId];
        if (id == bytes32(0)) return false;
        return authorizations[id].consumed;
    }
}
