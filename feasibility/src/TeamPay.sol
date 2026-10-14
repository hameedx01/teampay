// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ProjectPayments} from "./ProjectPayments.sol";

/// @notice Testnet candidate. Public project descriptions are immutable.
/// Payment accounting and independent withdrawals are inherited from ProjectPayments.
contract TeamPay is ProjectPayments {
    mapping(uint256 => string) public projectMetadata;
    event ProjectPublished(uint256 indexed projectId, address indexed creator);

    function createWithMetadata(
        address[] calldata expenses, uint256[] calldata amounts,
        address[] calldata collaborators, uint16[] calldata shares,
        string calldata metadata
    ) external returns (uint256 id) {
        require(bytes(metadata).length > 0 && bytes(metadata).length <= 4096, "Metadata length");
        // The external self-call preserves the original, tested allocation implementation.
        // Publication and metadata persistence are atomic in the same transaction.
        id = this.create(expenses, amounts, collaborators, shares, keccak256(bytes(metadata)));
        projectMetadata[id] = metadata;
        emit ProjectPublished(id, msg.sender);
    }
}
