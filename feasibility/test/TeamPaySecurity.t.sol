// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {TeamPay} from "../src/TeamPay.sol";
interface SecurityVm {function deal(address,uint256) external;function expectRevert() external;}
contract ReentrantRecipient {
    TeamPay immutable payments;
    address payable immutable other;
    bool public nestedSelfSucceeded;
    bool public nestedOtherSucceeded;
    constructor(TeamPay p,address payable recipient){payments=p;other=recipient;}
    receive() external payable {
        (nestedSelfSucceeded,)=address(payments).call(abi.encodeCall(payments.claim,(payable(address(this)))));
        (nestedOtherSucceeded,)=address(payments).call(abi.encodeCall(payments.claim,(other)));
    }
}
contract TeamPaySecurityTest {
    SecurityVm constant vm=SecurityVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TeamPay payments;
    address payable other=payable(address(0xB002));
    function setUp() public {payments=new TeamPay();vm.deal(address(this),100 ether);}
    function publish(address first,string memory metadata) internal returns(uint256){
        address[] memory recipients=new address[](2);recipients[0]=first;recipients[1]=other;
        uint16[] memory shares=new uint16[](2);shares[0]=5000;shares[1]=5000;
        return payments.createWithMetadata(new address[](0),new uint256[](0),recipients,shares,metadata);
    }
    function testReentrantClaimsCannotDrainOwnOrOtherCredit() public {
        ReentrantRecipient attacker=new ReentrantRecipient(payments,other);
        uint256 id=publish(address(attacker),"{}");payments.pay{value:2 ether}(id);
        payments.claim(payable(address(attacker)));
        require(!attacker.nestedSelfSucceeded()&&!attacker.nestedOtherSucceeded());
        require(address(attacker).balance==1 ether&&payments.claimable(address(attacker))==0);
        require(payments.claimable(other)==1 ether&&address(payments).balance==1 ether);
        payments.claim(other);require(other.balance==1 ether&&address(payments).balance==0);
    }
    function testThirdPartyClaimPaysRecipientNotCaller() public {
        address payable recipient=payable(address(0xA002));uint256 id=publish(recipient,"{}");
        payments.pay{value:2 ether}(id);uint256 before=address(this).balance;
        payments.claim(recipient);require(address(this).balance==before&&recipient.balance==1 ether);
    }
    function testInvalidMetadataRollsBackPublication() public {
        vm.expectRevert();publish(address(0xA002),"");require(payments.projectCount()==0);
        vm.expectRevert();publish(address(0xA002),string(new bytes(4097)));require(payments.projectCount()==0);
        uint256 id=publish(address(0xA002),"{\"title\":\"Example\"}");
        require(id==1&&keccak256(bytes(payments.projectMetadata(id)))==keccak256(bytes("{\"title\":\"Example\"}")));
    }
    function testContractCannotBeItsOwnRecipient() public {vm.expectRevert();publish(address(payments),"{}");}
    function testPlainNativeTransferIsRejected() public {(bool ok,)=address(payments).call{value:1 ether}("");require(!ok&&address(payments).balance==0);}
}
