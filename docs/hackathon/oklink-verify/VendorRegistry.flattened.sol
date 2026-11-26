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

// src/VendorRegistry.sol

contract VendorRegistry is Ownable {
    struct Vendor {
        bytes32 vendorId;
        bytes32 organizationId;
        bool verified;
        address destination;
        uint64 destinationVersion;
    }

    mapping(bytes32 => Vendor) public vendors;
    mapping(bytes32 => mapping(address => bool)) public approvedDestinations;

    event VendorRegistered(bytes32 indexed organizationId, bytes32 indexed vendorId);
    event VendorVerified(bytes32 indexed vendorId, bool verified);
    event DestinationUpdated(
        bytes32 indexed vendorId, address indexed destination, uint64 version
    );

    address public orgRegistry;

    constructor(address initialOwner, address organizationRegistry_) Ownable(initialOwner) {
        orgRegistry = organizationRegistry_;
    }

    function registerVendor(bytes32 organizationId, bytes32 vendorId, address destination)
        external
        onlyOwner
    {
        require(vendors[vendorId].vendorId == bytes32(0), "exists");
        vendors[vendorId] = Vendor({
            vendorId: vendorId,
            organizationId: organizationId,
            verified: false,
            destination: destination,
            destinationVersion: 1
        });
        if (destination != address(0)) {
            approvedDestinations[vendorId][destination] = true;
        }
        emit VendorRegistered(organizationId, vendorId);
        emit DestinationUpdated(vendorId, destination, 1);
    }

    function setVerified(bytes32 vendorId, bool verified) external onlyOwner {
        require(vendors[vendorId].vendorId != bytes32(0), "unknown");
        vendors[vendorId].verified = verified;
        emit VendorVerified(vendorId, verified);
    }

    /// @notice Destination changes bump version and require re-approval.
    function setDestination(bytes32 vendorId, address destination) external onlyOwner {
        Vendor storage v = vendors[vendorId];
        require(v.vendorId != bytes32(0), "unknown");
        if (v.destination != address(0)) {
            approvedDestinations[vendorId][v.destination] = false;
        }
        v.destination = destination;
        unchecked {
            v.destinationVersion += 1;
        }
        v.verified = false;
        approvedDestinations[vendorId][destination] = true;
        emit DestinationUpdated(vendorId, destination, v.destinationVersion);
        emit VendorVerified(vendorId, false);
    }

    function isEligible(bytes32 vendorId, address destination) external view returns (bool) {
        Vendor memory v = vendors[vendorId];
        return v.verified && approvedDestinations[vendorId][destination];
    }
}

