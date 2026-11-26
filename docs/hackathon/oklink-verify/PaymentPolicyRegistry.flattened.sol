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

// src/PaymentPolicyRegistry.sol

contract PaymentPolicyRegistry is Ownable {
    struct Policy {
        bytes32 organizationId;
        string name;
        uint64 version;
        address processor;
        uint256 circuitId;
        bytes32 configHash;
        bool active;
    }

    // organizationId => version => policy
    mapping(bytes32 => mapping(uint64 => Policy)) public policies;
    mapping(bytes32 => uint64) public latestVersion;

    event PolicyRegistered(
        bytes32 indexed organizationId,
        uint64 indexed version,
        address processor,
        uint256 circuitId,
        bytes32 configHash
    );
    event PolicyDisabled(bytes32 indexed organizationId, uint64 indexed version);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerPolicy(
        bytes32 organizationId,
        string calldata name,
        address processor,
        uint256 circuitId,
        bytes32 configHash
    ) external onlyOwner returns (uint64 version) {
        version = latestVersion[organizationId] + 1;
        if (latestVersion[organizationId] > 0) {
            policies[organizationId][latestVersion[organizationId]].active = false;
            emit PolicyDisabled(organizationId, latestVersion[organizationId]);
        }
        policies[organizationId][version] = Policy({
            organizationId: organizationId,
            name: name,
            version: version,
            processor: processor,
            circuitId: circuitId,
            configHash: configHash,
            active: true
        });
        latestVersion[organizationId] = version;
        emit PolicyRegistered(organizationId, version, processor, circuitId, configHash);
    }

    function disable(bytes32 organizationId, uint64 version) external onlyOwner {
        policies[organizationId][version].active = false;
        emit PolicyDisabled(organizationId, version);
    }

    function getPolicy(bytes32 organizationId, uint64 version)
        external
        view
        returns (Policy memory)
    {
        return policies[organizationId][version];
    }
}

