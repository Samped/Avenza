// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {IERC20} from "./utils/IERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";
import {PaymentAuthorization} from "./PaymentAuthorization.sol";
import {PaymentRouter} from "./PaymentRouter.sol";
import {EmergencyControl} from "./EmergencyControl.sol";

/// @notice Organization-funded USDC vault. Platform relayer executes only after authorization.
contract BusinessTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    PaymentAuthorization public authorization;
    PaymentRouter public router;
    EmergencyControl public emergency;
    address public usdc;
    uint256 public chainIdAllow;
    address public relayer;

    mapping(bytes32 => uint256) public balances;
    mapping(bytes32 => uint256) public reserved;
    mapping(bytes32 => bool) public executedPayments;

    event Deposited(bytes32 indexed organizationId, address indexed from, uint256 amount);
    event Withdrawn(bytes32 indexed organizationId, address indexed to, uint256 amount);
    event PaymentExecuted(
        bytes32 indexed organizationId,
        bytes32 indexed paymentId,
        address indexed destination,
        uint256 amount,
        address token
    );

    constructor(
        address initialOwner,
        address authorization_,
        address router_,
        address emergency_,
        address usdc_,
        uint256 chainIdAllow_,
        address relayer_
    ) Ownable(initialOwner) {
        authorization = PaymentAuthorization(authorization_);
        router = PaymentRouter(router_);
        emergency = EmergencyControl(emergency_);
        usdc = usdc_;
        chainIdAllow = chainIdAllow_;
        relayer = relayer_;
    }

    function setRelayer(address relayer_) external onlyOwner {
        relayer = relayer_;
    }

    function available(bytes32 organizationId) public view returns (uint256) {
        return balances[organizationId] - reserved[organizationId];
    }

    function deposit(bytes32 organizationId, uint256 amount) external nonReentrant {
        emergency.requireOperational(organizationId);
        require(amount > 0, "amount");
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        balances[organizationId] += amount;
        emit Deposited(organizationId, msg.sender, amount);
    }

    function withdraw(bytes32 organizationId, address to, uint256 amount) external onlyOwner nonReentrant {
        emergency.requireOperational(organizationId);
        require(amount <= available(organizationId), "insufficient");
        balances[organizationId] -= amount;
        IERC20(usdc).safeTransfer(to, amount);
        emit Withdrawn(organizationId, to, amount);
    }

    function executeAuthorizedPayment(
        bytes32 organizationId,
        bytes32 paymentId,
        bytes32 authorizationId,
        address token,
        address destination,
        uint256 amount
    ) external nonReentrant {
        require(msg.sender == relayer || msg.sender == owner(), "unauthorized");
        emergency.requireOperational(organizationId);
        require(!executedPayments[paymentId], "already executed");
        require(token == usdc, "token");
        require(amount <= available(organizationId), "insufficient");

        bool ok = authorization.consume(authorizationId, paymentId, amount, token, destination);
        require(ok, "auth");

        executedPayments[paymentId] = true;
        balances[organizationId] -= amount;

        // Prefer router allowlist path when treasury approved as adapter; else direct transfer
        IERC20(token).approve(address(router), 0);
        IERC20(token).approve(address(router), amount);
        // Direct safe transfer is the fail-safe if router not funded as holder —
        // router.route pulls from its own balance; treasury holds funds, so transfer directly.
        IERC20(token).safeTransfer(destination, amount);

        emit PaymentExecuted(organizationId, paymentId, destination, amount, token);
    }
}
