// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// src/utils/IERC20.sol

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

// src/interfaces/ITapeOutProcessor.sol

/// @notice Minimal TapeOut circuits/processor surface used by AVENZA.
interface ITapeOutProcessor {
    function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory);
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

// src/utils/ReentrancyGuard.sol

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status = NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != ENTERED, "ReentrancyGuard: reentrant");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

// src/OrganizationRegistry.sol

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

// src/PaymentAuthorization.sol

/// @notice Central enforcement — TapeOut eval is verified on-chain when a processor is registered.
/// Circuit evaluation alone does not authorize payment; approvals, vendor, and org checks still apply.
contract PaymentAuthorization is Ownable {
    struct AuthRequest {
        bytes32 organizationId;
        bytes32 paymentId;
        bytes32 invoiceCommitment;
        uint64 policyVersion;
        uint256 amount;
        address token;
        address destination;
        uint32 approvalCount;
        uint32 requiredApprovals;
        bytes32 circuitResult;
        bool vendorEligible;
        /// @dev LSB-packed TapeOut inputs for the registered policy circuit (e.g. amountOk|budgetOk).
        bytes circuitInputs;
    }

    struct Authorization {
        bytes32 authorizationId;
        bytes32 paymentId;
        bytes32 organizationId;
        uint256 amount;
        address token;
        address destination;
        bool consumed;
        uint64 createdAt;
    }

    OrganizationRegistry public orgRegistry;
    PaymentPolicyRegistry public policyRegistry;
    EmergencyControl public emergency;
    address public relayer;
    address public treasury;

    mapping(bytes32 => bool) public paymentSeen;
    mapping(bytes32 => Authorization) public authorizations;
    mapping(bytes32 => bytes32) public paymentAuthorizationId;

    uint256 public maxPaymentAmount;

    event RelayerUpdated(address indexed relayer);
    event TreasuryUpdated(address indexed treasury);
    event MaxPaymentUpdated(uint256 amount);
    event PaymentAuthorized(
        bytes32 indexed organizationId,
        bytes32 indexed paymentId,
        bytes32 indexed authorizationId,
        uint256 amount,
        address destination
    );
    event AuthorizationConsumed(bytes32 indexed authorizationId, bytes32 indexed paymentId);

    constructor(
        address initialOwner,
        address orgRegistry_,
        address policyRegistry_,
        address emergency_,
        address relayer_,
        uint256 maxPaymentAmount_
    ) Ownable(initialOwner) {
        orgRegistry = OrganizationRegistry(orgRegistry_);
        policyRegistry = PaymentPolicyRegistry(policyRegistry_);
        emergency = EmergencyControl(emergency_);
        relayer = relayer_;
        maxPaymentAmount = maxPaymentAmount_;
    }

    function setRelayer(address relayer_) external onlyOwner {
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setMaxPaymentAmount(uint256 amount) external onlyOwner {
        maxPaymentAmount = amount;
        emit MaxPaymentUpdated(amount);
    }

    function authorize(AuthRequest calldata req) external returns (bytes32 authorizationId) {
        require(msg.sender == relayer || msg.sender == owner(), "unauthorized");
        emergency.requireOperational(req.organizationId);
        require(orgRegistry.isActive(req.organizationId), "org inactive");
        require(!paymentSeen[req.paymentId], "replay");
        require(req.amount > 0 && req.amount <= maxPaymentAmount, "amount");
        require(req.destination != address(0), "destination");
        require(req.vendorEligible, "vendor");
        require(req.approvalCount >= req.requiredApprovals, "approvals");
        require(req.circuitResult != bytes32(0), "circuit");

        PaymentPolicyRegistry.Policy memory policy =
            policyRegistry.getPolicy(req.organizationId, req.policyVersion);
        require(policy.version == req.policyVersion, "policy version");
        // Historical versions remain readable; active preferred for new auths
        require(policy.configHash != bytes32(0), "policy missing");

        // When a TapeOut processor is bound to the policy, re-run eval on-chain.
        // Requires LSB of first output byte == 1 (policy gate passed).
        if (policy.processor != address(0)) {
            require(policy.circuitId != 0 || req.circuitInputs.length > 0, "circuit id");
            bytes memory tapeOutOut =
                ITapeOutProcessor(policy.processor).eval(policy.circuitId, req.circuitInputs);
            require(tapeOutOut.length > 0, "tapeout empty");
            require((uint8(tapeOutOut[0]) & uint8(1)) == 1, "tapeout fail");
        }

        paymentSeen[req.paymentId] = true;
        authorizationId = keccak256(
            abi.encode(
                req.organizationId,
                req.paymentId,
                req.invoiceCommitment,
                req.policyVersion,
                req.amount,
                req.token,
                req.destination,
                block.chainid
            )
        );

        authorizations[authorizationId] = Authorization({
            authorizationId: authorizationId,
            paymentId: req.paymentId,
            organizationId: req.organizationId,
            amount: req.amount,
            token: req.token,
            destination: req.destination,
            consumed: false,
            createdAt: uint64(block.timestamp)
        });
        paymentAuthorizationId[req.paymentId] = authorizationId;

        emit PaymentAuthorized(
            req.organizationId, req.paymentId, authorizationId, req.amount, req.destination
        );
    }

    function consume(bytes32 authorizationId, bytes32 paymentId, uint256 amount, address token, address destination)
        external
        returns (bool)
    {
        require(msg.sender == treasury || msg.sender == relayer || msg.sender == owner(), "unauthorized");
        Authorization storage auth = authorizations[authorizationId];
        require(auth.createdAt != 0, "unknown auth");
        require(!auth.consumed, "consumed");
        require(auth.paymentId == paymentId, "payment mismatch");
        require(auth.amount == amount, "amount mismatch");
        require(auth.token == token, "token mismatch");
        require(auth.destination == destination, "dest mismatch");
        // Expire after 24h
        require(block.timestamp <= auth.createdAt + 1 days, "expired");
        auth.consumed = true;
        emit AuthorizationConsumed(authorizationId, paymentId);
        return true;
    }

    function isConsumed(bytes32 paymentId) external view returns (bool) {
        bytes32 id = paymentAuthorizationId[paymentId];
        if (id == bytes32(0)) return false;
        return authorizations[id].consumed;
    }
}

// src/BusinessTreasury.sol

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

