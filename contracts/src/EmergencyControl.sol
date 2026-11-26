// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";
import {Pausable} from "./utils/Pausable.sol";

/// @notice Platform-wide emergency pause. Restrict owner to multisig in production.
contract EmergencyControl is Ownable, Pausable {
    event OrganizationSuspended(bytes32 indexed organizationId, bool suspended);

    mapping(bytes32 => bool) public organizationSuspended;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setOrganizationSuspended(bytes32 organizationId, bool suspended) external onlyOwner {
        organizationSuspended[organizationId] = suspended;
        emit OrganizationSuspended(organizationId, suspended);
    }

    function requireOperational(bytes32 organizationId) external view {
        require(!paused(), "EmergencyControl: paused");
        require(!organizationSuspended[organizationId], "EmergencyControl: org suspended");
    }
}
