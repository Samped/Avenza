// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// src/interfaces/ITapeOutProcessor.sol

/// @notice Minimal TapeOut circuits/processor surface used by AVENZA.
interface ITapeOutProcessor {
    function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory);
}

// src/mocks/MockTapeOutProcessor.sol

/// @dev Deterministic TapeOut stand-in for Foundry tests (AND of first two input bits).
contract MockTapeOutProcessor is ITapeOutProcessor {
    function eval(uint256, /* circuitId */ bytes calldata inputs) external pure returns (bytes memory) {
        uint8 packed = inputs.length > 0 ? uint8(inputs[0]) : 0;
        bool a = (packed & 1) == 1;
        bool b = (packed & 2) == 2;
        bytes memory out = new bytes(1);
        out[0] = bytes1(uint8((a && b) ? 1 : 0));
        return out;
    }
}

