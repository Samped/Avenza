// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// src/utils/Ownable.sol

abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: zero");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: not owner");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Ownable: zero");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// src/utils/Pausable.sol

abstract contract Pausable {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function _pause() internal {
        _paused = true;
        emit Paused(msg.sender);
    }

    function _unpause() internal {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

// src/EmergencyControl.sol

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

