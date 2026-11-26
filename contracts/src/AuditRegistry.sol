// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";

/// @notice Minimal on-chain commitments only — never store raw invoices or PII.
contract AuditRegistry is Ownable {
    struct Record {
        bytes32 organizationId;
        bytes32 invoiceCommitment;
        bytes32 paymentId;
        uint64 policyVersion;
        bytes32 authorizationRef;
        bytes32 settlementRef;
        uint8 eventType;
        uint64 timestamp;
    }

    mapping(bytes32 => Record) public records;
    mapping(bytes32 => bytes32[]) public orgRecords;

    event AuditCommitted(bytes32 indexed organizationId, bytes32 indexed recordId, uint8 eventType);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function commit(
        bytes32 recordId,
        bytes32 organizationId,
        bytes32 invoiceCommitment,
        bytes32 paymentId,
        uint64 policyVersion,
        bytes32 authorizationRef,
        bytes32 settlementRef,
        uint8 eventType
    ) external onlyOwner {
        require(records[recordId].timestamp == 0, "exists");
        records[recordId] = Record({
            organizationId: organizationId,
            invoiceCommitment: invoiceCommitment,
            paymentId: paymentId,
            policyVersion: policyVersion,
            authorizationRef: authorizationRef,
            settlementRef: settlementRef,
            eventType: eventType,
            timestamp: uint64(block.timestamp)
        });
        orgRecords[organizationId].push(recordId);
        emit AuditCommitted(organizationId, recordId, eventType);
    }
}
