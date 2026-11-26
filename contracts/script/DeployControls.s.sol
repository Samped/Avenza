// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ControlsRegistry} from "../src/ControlsRegistry.sol";
import {PaymentAuthorization} from "../src/PaymentAuthorization.sol";
import {BusinessTreasury} from "../src/BusinessTreasury.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

/// @notice Deploy ControlsRegistry + controls-aware PaymentAuthorization/Treasury
/// against an already-deployed X Layer registry stack (orgs/policies/emergency/router).
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY
///   ORGANIZATION_REGISTRY_ADDRESS
///   PAYMENT_POLICY_REGISTRY_ADDRESS
///   EMERGENCY_CONTROL_ADDRESS
///   PAYMENT_ROUTER_ADDRESS
///   USDC_TOKEN_ADDRESS
///   XLAYER_CHAIN_ID
///   ORGANIZATION_ONCHAIN_ID
///
/// Optional:
///   RELAYER_PRIVATE_KEY — defaults to deployer
contract DeployControlsScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", deployerKey);
        address relayer = vm.addr(relayerKey);

        address orgs = vm.envAddress("ORGANIZATION_REGISTRY_ADDRESS");
        address policies = vm.envAddress("PAYMENT_POLICY_REGISTRY_ADDRESS");
        address emergency = vm.envAddress("EMERGENCY_CONTROL_ADDRESS");
        address routerAddr = vm.envAddress("PAYMENT_ROUTER_ADDRESS");
        address usdc = vm.envAddress("USDC_TOKEN_ADDRESS");
        uint256 chainId = vm.envUint("XLAYER_CHAIN_ID");
        bytes32 orgId = vm.envBytes32("ORGANIZATION_ONCHAIN_ID");

        vm.startBroadcast(deployerKey);

        ControlsRegistry controls = new ControlsRegistry(deployer);
        PaymentAuthorization auth = new PaymentAuthorization(
            deployer, orgs, policies, emergency, relayer, 50_000_000e6
        );
        BusinessTreasury treasury = new BusinessTreasury(
            deployer, address(auth), routerAddr, emergency, usdc, chainId, relayer
        );
        auth.setTreasury(address(treasury));
        auth.setControlsRegistry(address(controls));
        address vendorRegistry = vm.envOr("VENDOR_REGISTRY_ADDRESS", address(0));
        if (vendorRegistry != address(0)) {
            auth.setVendorRegistry(vendorRegistry);
        }

        PaymentRouter(routerAddr).setAdapter(address(treasury), true);

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
            keccak256("avenza-default-controls")
        );

        vm.stopBroadcast();

        console2.log("CONTROLS_REGISTRY_ADDRESS", address(controls));
        console2.log("PAYMENT_AUTHORIZATION_ADDRESS", address(auth));
        console2.log("TREASURY_ADDRESS", address(treasury));
        console2.log("RELAYER_ADDRESS", relayer);
        console2.logBytes32(orgId);
    }
}
