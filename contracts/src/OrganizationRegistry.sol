// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";

contract OrganizationRegistry is Ownable {
    struct Organization {
        bytes32 id;
        address admin;
        bool active;
        bytes32 policyRef;
    }

    mapping(bytes32 => Organization) public organizations;
    mapping(bytes32 => mapping(address => bool)) public orgAdmins;

    event OrganizationRegistered(bytes32 indexed id, address indexed admin);
    event OrganizationStatusChanged(bytes32 indexed id, bool active);
    event AdminUpdated(bytes32 indexed id, address indexed admin, bool granted);
    event PolicyRefUpdated(bytes32 indexed id, bytes32 policyRef);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function register(bytes32 id, address admin, bytes32 policyRef) external onlyOwner {
        require(id != bytes32(0), "invalid id");
        require(organizations[id].admin == address(0), "exists");
        organizations[id] = Organization({id: id, admin: admin, active: true, policyRef: policyRef});
        orgAdmins[id][admin] = true;
        emit OrganizationRegistered(id, admin);
        emit PolicyRefUpdated(id, policyRef);
    }

    function setActive(bytes32 id, bool active) external onlyOwner {
        require(organizations[id].admin != address(0), "unknown");
        organizations[id].active = active;
        emit OrganizationStatusChanged(id, active);
    }

    function setAdmin(bytes32 id, address admin, bool granted) external {
        Organization storage org = organizations[id];
        require(org.admin != address(0), "unknown");
        require(msg.sender == owner() || orgAdmins[id][msg.sender], "unauthorized");
        orgAdmins[id][admin] = granted;
        emit AdminUpdated(id, admin, granted);
    }

    function setPolicyRef(bytes32 id, bytes32 policyRef) external {
        require(orgAdmins[id][msg.sender] || msg.sender == owner(), "unauthorized");
        organizations[id].policyRef = policyRef;
        emit PolicyRefUpdated(id, policyRef);
    }

    function isActive(bytes32 id) external view returns (bool) {
        return organizations[id].active;
    }
}
