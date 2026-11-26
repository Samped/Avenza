// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";
import {IERC20} from "./utils/IERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";

/// @notice Explicit asset/network allowlist for settlement adapters.
contract PaymentRouter is Ownable {
    using SafeERC20 for IERC20;

    mapping(uint256 => mapping(address => bool)) public allowedToken; // chainId => token => ok
    mapping(address => bool) public adapters;

    event TokenAllowlisted(uint256 indexed chainId, address indexed token, bool allowed);
    event AdapterUpdated(address indexed adapter, bool allowed);
    event Routed(
        address indexed token, address indexed to, uint256 amount, address indexed caller
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setTokenAllowed(uint256 chainId, address token, bool allowed) external onlyOwner {
        allowedToken[chainId][token] = allowed;
        emit TokenAllowlisted(chainId, token, allowed);
    }

    function setAdapter(address adapter, bool allowed) external onlyOwner {
        adapters[adapter] = allowed;
        emit AdapterUpdated(adapter, allowed);
    }

    function route(uint256 chainId, address token, address to, uint256 amount) external {
        require(adapters[msg.sender], "PaymentRouter: not adapter");
        require(allowedToken[chainId][token], "PaymentRouter: token not allowed");
        require(to != address(0), "PaymentRouter: zero dest");
        IERC20(token).safeTransfer(to, amount);
        emit Routed(token, to, amount, msg.sender);
    }
}
