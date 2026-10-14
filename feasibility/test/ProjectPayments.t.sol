// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ProjectPayments} from "../src/ProjectPayments.sol";
interface Vm { function deal(address, uint256) external; function expectRevert() external; }
contract RejectingRecipient { receive() external payable { revert(); } }
contract ProjectPaymentsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ProjectPayments payments;
    address payable a = payable(address(0xA001));
    address payable b = payable(address(0xB001));
    address payable c = payable(address(0xC001));
    function setUp() public { payments = new ProjectPayments(); vm.deal(address(this), 1e32); }
    function createProject(address first) internal returns (uint256) {
        address[] memory expenses = new address[](2); expenses[0] = first; expenses[1] = b;
        uint256[] memory amounts = new uint256[](2); amounts[0] = 200 ether; amounts[1] = 100 ether;
        address[] memory members = new address[](3); members[0] = first; members[1] = b; members[2] = c;
        uint16[] memory shares = new uint16[](3); shares[0] = 3333; shares[1] = 3333; shares[2] = 3334;
        return payments.create(expenses, amounts, members, shares, keccak256("example terms"));
    }
    function testPartialPaymentsAndClaims() public {
        uint256 id = createProject(a);
        payments.pay{value: 150 ether}(id); require(payments.claimable(a) == 150 ether);
        payments.pay{value: 100 ether}(id);
        require(payments.claimable(a) == 200 ether && payments.claimable(b) == 50 ether);
        payments.pay{value: 350 ether}(id);
        require(payments.claimable(a) == 299.99 ether && payments.claimable(b) == 199.99 ether);
        require(payments.claimable(c) == 100.02 ether);
        payments.claim(a); payments.claim(b); payments.claim(c);
        require(address(payments).balance == 0);
        vm.expectRevert(); payments.claim(a);
    }
    function testProjectsDoNotShareExpenseProgress() public {
        uint256 one = createProject(a); uint256 two = createProject(a);
        payments.pay{value: 300 ether}(one); payments.pay{value: 10 ether}(two);
        require(payments.project(one).remainingExpenses[0] == 0);
        require(payments.project(two).remainingExpenses[0] == 190 ether);
    }
    function testRejectingRecipientDoesNotBlockOthers() public {
        address rejecting = address(new RejectingRecipient());
        uint256 id = createProject(rejecting); payments.pay{value: 600 ether}(id);
        vm.expectRevert(); payments.claim(payable(rejecting));
        require(payments.claimable(rejecting) == 299.99 ether);
        payments.claim(b); payments.claim(c);
        require(address(payments).balance == payments.claimable(rejecting));
    }
    function testUnknownProjectAndZeroPaymentRevert() public {
        vm.expectRevert(); payments.pay{value: 1}(1);
        uint256 id = createProject(a); vm.expectRevert(); payments.pay(id);
    }
    function testZeroRecipientReverts() public { vm.expectRevert(); createProject(address(0)); }
    function testFuzzConservesPayments(uint128 raw) public {
        uint256 amount = uint256(raw) % 1e30 + 1;
        uint256 id = createProject(a);
        payments.pay{value: amount / 2 + 1}(id);
        payments.pay{value: amount}(id);
        require(payments.claimable(a) + payments.claimable(b) + payments.claimable(c) == amount + amount / 2 + 1);
        payments.claim(a);
        if (payments.claimable(b) > 0) payments.claim(b);
        if (payments.claimable(c) > 0) payments.claim(c);
        require(address(payments).balance == 0);
    }
}
