// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";

/// @notice On-chain AP controls for AVENZA (unlike Custara's off-chain-only policy).
/// Relayer publishes versioned rules; PaymentAuthorization re-evaluates before settle.
contract ControlsRegistry is Ownable {
    uint8 public constant DECISION_AUTO_APPROVE = 0;
    uint8 public constant DECISION_SINGLE = 1;
    uint8 public constant DECISION_DUAL = 2;
    uint8 public constant DECISION_HOLD = 3;

    struct Controls {
        uint256 autoApproveMaxUsdc; // 6 decimals
        uint256 singleApproverMaxUsdc;
        uint256 dualControlAboveUsdc;
        uint16 minConfidenceBps; // 7500 = 0.75
        bool holdOnNewVendor;
        bool holdOnDestinationChange;
        bool holdOnDuplicate;
        bool requirePurchaseOrder;
        bool requirePoMatch;
        bool holdOnUnknownDestination;
        bool blockAutoApproveUntilAllowlisted;
        bytes32 configHash;
        uint64 version;
        bool active;
    }

    /// @dev Risk / eligibility flags supplied at authorize time (API + on-chain re-check).
    struct RiskFlags {
        bool isNewVendor;
        bool destinationChanged;
        bool isDuplicate;
        bool missingPo;
        bool poMismatch;
        bool unknownDestination;
        bool supplierBlocked;
        uint16 confidenceBps;
    }

    struct Evaluation {
        uint8 decision;
        uint32 requiredApprovals;
        bytes32 reasonCode;
    }

    mapping(bytes32 => mapping(uint64 => Controls)) public controls;
    mapping(bytes32 => uint64) public latestVersion;

    event ControlsPublished(
        bytes32 indexed organizationId, uint64 indexed version, bytes32 configHash
    );
    event ControlsDisabled(bytes32 indexed organizationId, uint64 indexed version);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function publishControls(
        bytes32 organizationId,
        uint256 autoApproveMaxUsdc,
        uint256 singleApproverMaxUsdc,
        uint256 dualControlAboveUsdc,
        uint16 minConfidenceBps,
        bool holdOnNewVendor,
        bool holdOnDestinationChange,
        bool holdOnDuplicate,
        bool requirePurchaseOrder,
        bool requirePoMatch,
        bool holdOnUnknownDestination,
        bool blockAutoApproveUntilAllowlisted,
        bytes32 configHash
    ) external onlyOwner returns (uint64 version) {
        require(dualControlAboveUsdc >= singleApproverMaxUsdc, "thresholds");
        require(minConfidenceBps <= 10_000, "confidence");

        version = latestVersion[organizationId] + 1;
        if (latestVersion[organizationId] > 0) {
            controls[organizationId][latestVersion[organizationId]].active = false;
            emit ControlsDisabled(organizationId, latestVersion[organizationId]);
        }

        controls[organizationId][version] = Controls({
            autoApproveMaxUsdc: autoApproveMaxUsdc,
            singleApproverMaxUsdc: singleApproverMaxUsdc,
            dualControlAboveUsdc: dualControlAboveUsdc,
            minConfidenceBps: minConfidenceBps,
            holdOnNewVendor: holdOnNewVendor,
            holdOnDestinationChange: holdOnDestinationChange,
            holdOnDuplicate: holdOnDuplicate,
            requirePurchaseOrder: requirePurchaseOrder,
            requirePoMatch: requirePoMatch,
            holdOnUnknownDestination: holdOnUnknownDestination,
            blockAutoApproveUntilAllowlisted: blockAutoApproveUntilAllowlisted,
            configHash: configHash,
            version: version,
            active: true
        });
        latestVersion[organizationId] = version;
        emit ControlsPublished(organizationId, version, configHash);
    }

    function getControls(bytes32 organizationId, uint64 version)
        external
        view
        returns (Controls memory)
    {
        return controls[organizationId][version];
    }

    /// @notice Pure policy gate used by PaymentAuthorization before settlement.
    function evaluate(bytes32 organizationId, uint256 amountUsdc, RiskFlags calldata flags)
        external
        view
        returns (Evaluation memory result)
    {
        uint64 v = latestVersion[organizationId];
        require(v > 0, "no controls");
        Controls memory c = controls[organizationId][v];
        require(c.active && c.configHash != bytes32(0), "controls inactive");

        if (flags.supplierBlocked) {
            return Evaluation(DECISION_HOLD, 1, keccak256("supplier_blocked"));
        }
        if (c.holdOnDuplicate && flags.isDuplicate) {
            return Evaluation(DECISION_HOLD, 1, keccak256("duplicate"));
        }
        if (c.holdOnUnknownDestination && flags.unknownDestination) {
            return Evaluation(DECISION_HOLD, 1, keccak256("unknown_destination"));
        }
        if (c.blockAutoApproveUntilAllowlisted && flags.unknownDestination) {
            return Evaluation(DECISION_HOLD, 1, keccak256("not_allowlisted"));
        }
        if (c.requirePurchaseOrder && flags.missingPo) {
            return Evaluation(DECISION_HOLD, 1, keccak256("missing_po"));
        }
        if (c.requirePoMatch && flags.poMismatch) {
            return Evaluation(DECISION_HOLD, 1, keccak256("po_mismatch"));
        }
        if (c.holdOnNewVendor && flags.isNewVendor) {
            return Evaluation(DECISION_HOLD, 1, keccak256("new_vendor"));
        }
        if (c.holdOnDestinationChange && flags.destinationChanged) {
            return Evaluation(DECISION_HOLD, 1, keccak256("destination_change"));
        }
        if (flags.confidenceBps < c.minConfidenceBps) {
            return Evaluation(DECISION_HOLD, 1, keccak256("low_confidence"));
        }

        if (
            amountUsdc <= c.autoApproveMaxUsdc && !flags.isNewVendor && !flags.destinationChanged
                && !flags.unknownDestination
        ) {
            return Evaluation(DECISION_AUTO_APPROVE, 0, keccak256("auto_approve"));
        }
        if (amountUsdc <= c.singleApproverMaxUsdc) {
            return Evaluation(DECISION_SINGLE, 1, keccak256("single_approval"));
        }
        return Evaluation(DECISION_DUAL, 2, keccak256("dual_control"));
    }
}
