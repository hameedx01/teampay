// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Feasibility prototype ONLY. Not audited or approved for deployment.
/// Uses native USDC (18 decimals on Arc). No token recovery/admin paths.
contract ProjectPayments {
    struct Project {
        address[] expenseRecipients;
        uint256[] remainingExpenses;
        address[] collaborators;
        uint16[] shares;
        uint256 received;
    }
    uint256 public projectCount;
    mapping(uint256 => Project) private projects;
    mapping(address => uint256) public claimable;
    uint256 private entered;
    event Created(uint256 indexed projectId, bytes32 termsHash);
    event Funded(uint256 indexed projectId, address indexed payer, uint256 amount);
    event Allocated(uint256 indexed projectId, address indexed recipient, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);

    function create(address[] calldata expenses, uint256[] calldata amounts,
        address[] calldata collaborators, uint16[] calldata shares, bytes32 termsHash
    ) external returns (uint256 id) {
        require(expenses.length == amounts.length && expenses.length <= 10);
        require(collaborators.length > 0 && collaborators.length <= 10);
        require(collaborators.length == shares.length);
        uint256 total;
        for (uint256 i; i < collaborators.length; ++i) {
            require(collaborators[i] != address(0) && collaborators[i] != address(this) && shares[i] > 0);
            total += shares[i];
        }
        require(total == 10_000);
        for (uint256 i; i < expenses.length; ++i) {
            require(expenses[i] != address(0) && expenses[i] != address(this) && amounts[i] > 0);
        }
        id = ++projectCount;
        Project storage p = projects[id];
        p.expenseRecipients = expenses;
        p.remainingExpenses = amounts;
        p.collaborators = collaborators;
        p.shares = shares;
        emit Created(id, termsHash);
    }

    /// Allocates a payment; recipients withdraw separately so a rejecting
    /// recipient cannot stop other recipients from withdrawing their funds.
    function pay(uint256 id) external payable {
        require(id > 0 && id <= projectCount && msg.value > 0);
        Project storage p = projects[id];
        p.received += msg.value;
        uint256 remainder = msg.value;
        for (uint256 i; i < p.expenseRecipients.length && remainder > 0; ++i) {
            uint256 amount = remainder < p.remainingExpenses[i] ? remainder : p.remainingExpenses[i];
            p.remainingExpenses[i] -= amount;
            remainder -= amount;
            _credit(id, p.expenseRecipients[i], amount);
        }
        uint256 residual = remainder;
        for (uint256 i; i < p.collaborators.length && remainder > 0; ++i) {
            // Last recipient receives division dust for this payment.
            uint256 amount = i + 1 == p.collaborators.length
                ? remainder : (residual / 10_000) * p.shares[i] + (residual % 10_000) * p.shares[i] / 10_000;
            remainder -= amount;
            _credit(id, p.collaborators[i], amount);
        }
        emit Funded(id, msg.sender, msg.value);
    }

    function claim(address payable recipient) external {
        require(entered == 0);
        entered = 1;
        uint256 amount = claimable[recipient];
        require(amount > 0);
        claimable[recipient] = 0;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok);
        entered = 0;
        emit Claimed(recipient, amount);
    }

    function project(uint256 id) external view returns (Project memory) {
        require(id > 0 && id <= projectCount);
        return projects[id];
    }

    function _credit(uint256 id, address recipient, uint256 amount) private {
        if (amount == 0) return;
        claimable[recipient] += amount;
        emit Allocated(id, recipient, amount);
    }
}
