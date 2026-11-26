// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EmergencyControl} from "../src/EmergencyControl.sol";
import {OrganizationRegistry} from "../src/OrganizationRegistry.sol";
import {VendorRegistry} from "../src/VendorRegistry.sol";
import {PaymentPolicyRegistry} from "../src/PaymentPolicyRegistry.sol";
import {ControlsRegistry} from "../src/ControlsRegistry.sol";
import {PaymentAuthorization} from "../src/PaymentAuthorization.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {BusinessTreasury} from "../src/BusinessTreasury.sol";
import {AuditRegistry} from "../src/AuditRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockTapeOutProcessor} from "../src/mocks/MockTapeOutProcessor.sol";

contract PaymentFlowTest is Test {
    EmergencyControl emergency;
    OrganizationRegistry orgs;
    VendorRegistry vendors;
    PaymentPolicyRegistry policies;
    ControlsRegistry controls;
    PaymentAuthorization auth;
    PaymentRouter router;
    BusinessTreasury treasury;
    AuditRegistry audit;
    MockUSDC usdc;
    MockTapeOutProcessor tapeOut;

    address owner = address(this);
    address relayer = address(0xBEEF);
    address supplier = address(0xCAFE);
    bytes32 orgId = keccak256("org-1");
    bytes32 vendorId = keccak256("vendor-1");

    function setUp() public {
        usdc = new MockUSDC();
        tapeOut = new MockTapeOutProcessor();
        emergency = new EmergencyControl(owner);
        orgs = new OrganizationRegistry(owner);
        vendors = new VendorRegistry(owner, address(orgs));
        policies = new PaymentPolicyRegistry(owner);
        controls = new ControlsRegistry(owner);
        router = new PaymentRouter(owner);
        auth = new PaymentAuthorization(
            owner, address(orgs), address(policies), address(emergency), relayer, 1_000_000e6
        );
        treasury = new BusinessTreasury(
            owner, address(auth), address(router), address(emergency), address(usdc), 1952, relayer
        );
        auth.setTreasury(address(treasury));
        auth.setControlsRegistry(address(controls));
        auth.setVendorRegistry(address(vendors));
        audit = new AuditRegistry(owner);

        orgs.register(orgId, owner, bytes32(0));
        vendors.registerVendor(orgId, vendorId, supplier);
        vendors.setVerified(vendorId, true);
        policies.registerPolicy(orgId, "default", address(tapeOut), 1, keccak256("cfg"));
        controls.publishControls(
            orgId,
            1_000e6, // auto
            10_000e6, // single
            10_000e6, // dual above
            7500,
            true,
            true,
            true,
            false,
            false,
            true,
            true,
            keccak256("controls-v1")
        );
        router.setTokenAllowed(1952, address(usdc), true);

        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.deposit(orgId, 5_000e6);
    }

    function _clearRisk() internal pure returns (ControlsRegistry.RiskFlags memory) {
        return ControlsRegistry.RiskFlags({
            isNewVendor: false,
            destinationChanged: false,
            isDuplicate: false,
            missingPo: false,
            poMismatch: false,
            unknownDestination: false,
            supplierBlocked: false,
            confidenceBps: 10_000
        });
    }

    function _req(bytes32 paymentId, bytes memory circuitInputs, uint256 amount)
        internal
        view
        returns (PaymentAuthorization.AuthRequest memory)
    {
        return PaymentAuthorization.AuthRequest({
            organizationId: orgId,
            paymentId: paymentId,
            invoiceCommitment: keccak256("inv-1"),
            policyVersion: 1,
            controlsVersion: 1,
            amount: amount,
            token: address(usdc),
            destination: supplier,
            vendorId: vendorId,
            vendorEligible: true,
            approvalCount: 2,
            requiredApprovals: 2,
            circuitResult: bytes32(uint256(1)),
            circuitInputs: circuitInputs,
            risk: _clearRisk()
        });
    }

    function testVendorRegistryBlocksUnverified() public {
        vendors.setVerified(vendorId, false);
        vm.prank(relayer);
        vm.expectRevert("vendor");
        auth.authorize(_req(keccak256("pay-unverified"), hex"03", 100e6));
    }

    function testAuthorizeAndPay() public {
        bytes32 paymentId = keccak256("pay-1");

        vm.prank(relayer);
        bytes32 authorizationId = auth.authorize(_req(paymentId, hex"03", 100e6));

        uint256 beforeBal = usdc.balanceOf(supplier);
        vm.prank(relayer);
        treasury.executeAuthorizedPayment(
            orgId, paymentId, authorizationId, address(usdc), supplier, 100e6
        );
        assertEq(usdc.balanceOf(supplier), beforeBal + 100e6);
        assertTrue(auth.isConsumed(paymentId));
    }

    function testTapeOutFailBlocksAuth() public {
        vm.prank(relayer);
        vm.expectRevert("tapeout fail");
        auth.authorize(_req(keccak256("pay-fail"), hex"01", 100e6));
    }

    function testReplayBlocked() public {
        bytes32 paymentId = keccak256("pay-2");
        vm.startPrank(relayer);
        auth.authorize(_req(paymentId, hex"03", 100e6));
        vm.expectRevert("replay");
        auth.authorize(_req(paymentId, hex"03", 100e6));
        vm.stopPrank();
    }

    function testInsufficientApprovals() public {
        PaymentAuthorization.AuthRequest memory r = _req(keccak256("pay-3"), hex"03", 5_000e6);
        r.approvalCount = 0;
        r.requiredApprovals = 1;
        vm.prank(relayer);
        vm.expectRevert("approvals");
        auth.authorize(r);
    }

    function testControlsHoldBlocksAuth() public {
        PaymentAuthorization.AuthRequest memory r = _req(keccak256("pay-hold"), hex"03", 50e6);
        r.risk.isDuplicate = true;
        r.approvalCount = 2;
        r.requiredApprovals = 2;
        vm.prank(relayer);
        vm.expectRevert("controls hold");
        auth.authorize(r);
    }

    function testAutoApproveZeroApprovals() public {
        PaymentAuthorization.AuthRequest memory r = _req(keccak256("pay-auto"), hex"03", 500e6);
        r.approvalCount = 0;
        r.requiredApprovals = 0;
        vm.prank(relayer);
        auth.authorize(r);
    }

    function testPauseBlocksDeposit() public {
        emergency.pause();
        vm.expectRevert("EmergencyControl: paused");
        treasury.deposit(orgId, 1e6);
    }

    function testDoubleExecuteBlocked() public {
        bytes32 paymentId = keccak256("pay-4");
        PaymentAuthorization.AuthRequest memory r = _req(paymentId, hex"03", 10e6);
        r.approvalCount = 0;
        r.requiredApprovals = 0;
        vm.prank(relayer);
        bytes32 authorizationId = auth.authorize(r);
        vm.startPrank(relayer);
        treasury.executeAuthorizedPayment(
            orgId, paymentId, authorizationId, address(usdc), supplier, 10e6
        );
        vm.expectRevert("already executed");
        treasury.executeAuthorizedPayment(
            orgId, paymentId, authorizationId, address(usdc), supplier, 10e6
        );
        vm.stopPrank();
    }

    function testCollectPlatformFee() public {
        address feeWallet = address(0xFEE);
        bytes32 paymentId = keccak256("pay-fee");
        uint256 vaultBefore = treasury.available(orgId);
        vm.prank(relayer);
        treasury.collectFee(orgId, feeWallet, 25e4, paymentId); // $0.25
        assertEq(usdc.balanceOf(feeWallet), 25e4);
        assertEq(treasury.available(orgId), vaultBefore - 25e4);
    }
}
