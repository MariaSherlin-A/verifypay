// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

contract AgentWalletTest is Base {
    AgentWallet w;
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");

    function setUp() public override {
        super.setUp();
        _register("acme.com", acmeKey);
        w = new AgentWallet(reg, owner, agent, signer);
        usdc.mint(address(w), 1_000e6);
        _raise(100e6, 300e6);
    }

    function _raiseSig(uint128 per, uint128 day, uint256 n, uint256 deadline, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                w.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(w.RAISE_LIMITS_TYPEHASH(), address(w), address(usdc), per, day, n, deadline))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _raise(uint128 per, uint128 day) internal {
        bytes memory sig = _raiseSig(per, day, w.nonce(), block.timestamp + 1, signerPk);
        vm.prank(owner);
        w.raiseLimits(address(usdc), per, day, block.timestamp + 1, sig);
    }

    function test_AgentPaysVerifiedBusiness() public {
        vm.prank(agent);
        w.agentPay(address(usdc), acme, 40e6, "api-call-1");
        assertEq(usdc.balanceOf(acmeKey), 40e6);
        assertEq(w.spentToday(address(usdc)), 40e6);
    }

    function test_RevertWhen_PayeeFrozen() public {
        _report(acme, acmeKey, reg.ACTION_FREEZE());
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentWallet.PayeeNotActive.selector, PayeeRegistry.Status.Frozen));
        w.agentPay(address(usdc), acme, 1e6, "");
    }

    function test_RevertWhen_UnknownDomain() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentWallet.PayeeNotActive.selector, PayeeRegistry.Status.None));
        w.agentPay(address(usdc), keccak256("evil.com"), 1e6, "");
    }

    function testFuzz_RevertWhen_NotAgent(address caller) public {
        vm.assume(caller != agent);
        vm.prank(caller);
        vm.expectRevert(AgentWallet.NotAgent.selector);
        w.agentPay(address(usdc), acme, 1e6, "");
    }

    function testFuzz_CapsHold(uint256 a, uint256 b, uint256 c) public {
        uint256[3] memory amts = [bound(a, 1, 150e6), bound(b, 1, 150e6), bound(c, 1, 150e6)];
        uint256 total;
        for (uint256 i; i < 3; ++i) {
            vm.prank(agent);
            try w.agentPay(address(usdc), acme, amts[i], "") {
                total += amts[i];
            } catch {}
        }
        assertLe(total, 300e6);
        assertEq(usdc.balanceOf(acmeKey), total);
        assertEq(w.spentToday(address(usdc)), total);
    }

    function test_DailyCapResetsNextDay() public {
        vm.startPrank(agent);
        w.agentPay(address(usdc), acme, 100e6, "");
        w.agentPay(address(usdc), acme, 100e6, "");
        w.agentPay(address(usdc), acme, 100e6, "");
        vm.expectRevert(abi.encodeWithSelector(AgentWallet.OverDaily.selector, 301e6, 300e6));
        w.agentPay(address(usdc), acme, 1e6, "");
        vm.warp(block.timestamp + 1 days);
        w.agentPay(address(usdc), acme, 1e6, "");
        vm.stopPrank();
    }

    function testFuzz_RevertWhen_RaiseNotApproved(uint256 pk) public {
        pk = bound(pk, 1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140);
        vm.assume(pk != signerPk);
        bytes memory sig = _raiseSig(500e6, 1_000e6, w.nonce(), block.timestamp + 1, pk);
        vm.prank(owner);
        vm.expectRevert(AgentWallet.BadSignature.selector);
        w.raiseLimits(address(usdc), 500e6, 1_000e6, block.timestamp + 1, sig);
    }

    function test_RevertWhen_RaiseReplayed() public {
        uint256 n = w.nonce();
        bytes memory sig = _raiseSig(200e6, 400e6, n, block.timestamp + 1, signerPk);
        vm.startPrank(owner);
        w.raiseLimits(address(usdc), 200e6, 400e6, block.timestamp + 1, sig);
        vm.expectRevert(AgentWallet.BadSignature.selector);
        w.raiseLimits(address(usdc), 200e6, 400e6, block.timestamp + 1, sig);
        vm.stopPrank();
    }

    function test_LowerLimitsNeedsNoApproval_ButCannotRaise() public {
        vm.startPrank(owner);
        w.lowerLimits(address(usdc), 10e6, 20e6);
        vm.expectRevert(AgentWallet.NotARaise.selector);
        w.lowerLimits(address(usdc), 50e6, 20e6);
        vm.stopPrank();
    }

    function test_PauseStopsAgent() public {
        vm.prank(owner);
        w.setPaused(true);
        vm.prank(agent);
        vm.expectRevert(AgentWallet.IsPaused.selector);
        w.agentPay(address(usdc), acme, 1e6, "");
    }

    function test_FollowsPayoutRotation() public {
        address controller = makeAddr("ctrl");
        bytes32 d = _register("globex.com", controller);
        address newPayout = makeAddr("newPayout");
        bytes memory sig = _approval(d, newPayout, 0, block.timestamp + 1, signerPk);
        vm.prank(controller);
        reg.requestPayoutChange(d, newPayout, block.timestamp + 1, sig);
        vm.prank(agent);
        w.agentPay(address(usdc), d, 1e6, ""); // still the old payout during the delay
        assertEq(usdc.balanceOf(controller), 1e6);
        vm.warp(block.timestamp + DELAY);
        reg.executePayoutChange(d);
        vm.prank(agent);
        w.agentPay(address(usdc), d, 1e6, "");
        assertEq(usdc.balanceOf(newPayout), 1e6);
    }
}
