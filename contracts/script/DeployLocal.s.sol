// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
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

/// @notice Full local / Anvil deploy with MockUSDC + MockTapeOut for settlement demos.
contract DeployLocalScript is Script {
    function run() external {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);
        uint256 chainId = vm.envOr("XLAYER_CHAIN_ID", uint256(1952));
        bytes32 orgId = keccak256("avenza-demo-org");

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        MockTapeOutProcessor tapeOut = new MockTapeOutProcessor();
        EmergencyControl emergency = new EmergencyControl(deployer);
        OrganizationRegistry orgs = new OrganizationRegistry(deployer);
        VendorRegistry vendors = new VendorRegistry(deployer, address(orgs));
        PaymentPolicyRegistry policies = new PaymentPolicyRegistry(deployer);
        ControlsRegistry controls = new ControlsRegistry(deployer);
        PaymentRouter router = new PaymentRouter(deployer);
        PaymentAuthorization auth = new PaymentAuthorization(
            deployer, address(orgs), address(policies), address(emergency), deployer, 50_000_000e6
        );
        BusinessTreasury treasury =
            _deployTreasury(deployer, auth, router, emergency, usdc, chainId);
        auth.setTreasury(address(treasury));
        auth.setControlsRegistry(address(controls));
        auth.setVendorRegistry(address(vendors));
        router.setTokenAllowed(chainId, address(usdc), true);
        router.setAdapter(address(treasury), true);
        new AuditRegistry(deployer);

        orgs.register(orgId, deployer, bytes32(0));
        policies.registerPolicy(orgId, "default", address(tapeOut), 1, keccak256("avenza-cfg"));
        controls.publishControls(
            orgId,
            5_000e6,
            50_000e6,
            50_000e6,
            7500,
            true,
            true,
            true,
            false,
            false,
            true,
            true,
            keccak256("avenza-cfg-controls")
        );

        usdc.mint(deployer, 1_000_000e6);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.deposit(orgId, 100_000e6);

        vm.stopBroadcast();

        console2.log("USDC_TOKEN_ADDRESS", address(usdc));
        console2.log("TAPEOUT_PROCESSOR_ADDRESS", address(tapeOut));
        console2.log("PAYMENT_AUTHORIZATION_ADDRESS", address(auth));
        console2.log("TREASURY_ADDRESS", address(treasury));
        console2.log("PAYMENT_POLICY_REGISTRY_ADDRESS", address(policies));
        console2.log("CONTROLS_REGISTRY_ADDRESS", address(controls));
        console2.logBytes32(orgId);
    }

    function _deployTreasury(
        address deployer,
        PaymentAuthorization auth,
        PaymentRouter router,
        EmergencyControl emergency,
        MockUSDC usdc,
        uint256 chainId
    ) internal returns (BusinessTreasury) {
        return new BusinessTreasury(
            deployer,
            address(auth),
            address(router),
            address(emergency),
            address(usdc),
            chainId,
            deployer
        );
    }
}
