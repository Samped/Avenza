// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// src/utils/IERC20.sol

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

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

// src/utils/SafeERC20.sol

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _call(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _call(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: call failed");
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "SafeERC20: op failed");
        }
    }
}

// src/PaymentRouter.sol

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

