// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal TapeOut circuits/processor surface used by AVENZA.
interface ITapeOutProcessor {
    function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory);
}
