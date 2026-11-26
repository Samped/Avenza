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
import {MockTapeOutProcessor} from "../src/mocks/MockTapeOutProcessor.sol";

/// @notice Deploy AVENZA settlement stack on X Layer and bind a TapeOut processor to policy.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY  — funded key (hex with or without 0x)
///   USDC_TOKEN_ADDRESS
///   XLAYER_CHAIN_ID       — 1952 testnet / 196 mainnet
///
/// Optional:
///   RELAYER_PRIVATE_KEY   — defaults to deployer
///   TAPEOUT_PROCESSOR_ADDRESS — if unset: Cerebr on mainnet (196), MockTapeOut on other chains
///   TAPEOUT_CIRCUIT_ID    — default 1
contract DeployScript is Script {
    // Cerebr processor on X Layer mainnet — AND circuit #1 = PaymentLimit
    address constant CEREBR_MAINNET = 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", deployerKey);
        address relayer = vm.addr(relayerKey);

        address usdc = vm.envAddress("USDC_TOKEN_ADDRESS");
        uint256 chainId = vm.envUint("XLAYER_CHAIN_ID");
        uint256 circuitId = vm.envOr("TAPEOUT_CIRCUIT_ID", uint256(1));
        bytes32 orgId = keccak256(abi.encodePacked("avenza-org", deployer));

        vm.startBroadcast(deployerKey);

        // Prefer SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS so mainnet Cerebr in TAPEOUT_* env
        // is not accidentally bound on testnet (cross-chain calls are impossible).
        address tapeOutProcessor = vm.envOr("SETTLEMENT_TAPEOUT_PROCESSOR_ADDRESS", address(0));
        if (tapeOutProcessor == address(0)) {
            if (chainId == 196) {
                tapeOutProcessor = vm.envOr("TAPEOUT_PROCESSOR_ADDRESS", CEREBR_MAINNET);
            } else {
                // Mainnet Cerebr is not reachable from testnet — deploy a local AND processor.
                tapeOutProcessor = address(new MockTapeOutProcessor());
            }
        }

        EmergencyControl emergency = new EmergencyControl(deployer);
        OrganizationRegistry orgs = new OrganizationRegistry(deployer);
        VendorRegistry vendors = new VendorRegistry(deployer, address(orgs));
        PaymentPolicyRegistry policies = new PaymentPolicyRegistry(deployer);
        ControlsRegistry controls = new ControlsRegistry(deployer);
        PaymentRouter router = new PaymentRouter(deployer);
        PaymentAuthorization auth = new PaymentAuthorization(
            deployer, address(orgs), address(policies), address(emergency), relayer, 50_000_000e6
        );
        BusinessTreasury treasury = new BusinessTreasury(
            deployer, address(auth), address(router), address(emergency), usdc, chainId, relayer
        );
        auth.setTreasury(address(treasury));
        auth.setControlsRegistry(address(controls));
        auth.setVendorRegistry(address(vendors));
        router.setTokenAllowed(chainId, usdc, true);
        router.setAdapter(address(treasury), true);
        AuditRegistry audit = new AuditRegistry(deployer);

        orgs.register(orgId, deployer, bytes32(0));
        policies.registerPolicy(
            orgId, "default", tapeOutProcessor, circuitId, keccak256("avenza-default-policy")
        );
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

        console2.log("DEPLOYER_ADDRESS", deployer);
        console2.log("RELAYER_ADDRESS", relayer);
        console2.log("EMERGENCY_CONTROL_ADDRESS", address(emergency));
        console2.log("ORGANIZATION_REGISTRY_ADDRESS", address(orgs));
        console2.log("VENDOR_REGISTRY_ADDRESS", address(vendors));
        console2.log("PAYMENT_POLICY_REGISTRY_ADDRESS", address(policies));
        console2.log("CONTROLS_REGISTRY_ADDRESS", address(controls));
        console2.log("PAYMENT_AUTHORIZATION_ADDRESS", address(auth));
        console2.log("PAYMENT_ROUTER_ADDRESS", address(router));
        console2.log("TREASURY_ADDRESS", address(treasury));
        console2.log("AUDIT_REGISTRY_ADDRESS", address(audit));
        console2.log("TAPEOUT_PROCESSOR_ADDRESS", tapeOutProcessor);
        console2.log("TAPEOUT_CIRCUIT_ID", circuitId);
        console2.log("USDC_TOKEN_ADDRESS", usdc);
        console2.log("XLAYER_CHAIN_ID", chainId);
        console2.logBytes32(orgId);
    }
}
