// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Base, MockUSDC} from "./Base.t.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {SafeSend} from "../src/SafeSend.sol";

contract SafeSendTest is Base {
    function setUp() public override {
        super.setUp();
        _register("acme.com", acmeKey);
    }

    function test_PayByNameSettlesInstantly() public {
        vm.prank(payer);
        safe.payByName(address(usdc), acme, 500e6, "inv-1");
        assertEq(usdc.balanceOf(acmeKey), 500e6);
    }

    function test_RevertWhen_PayFrozenPayee() public {
        _report(acme, acmeKey, reg.ACTION_FREEZE());
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.PayeeNotActive.selector, PayeeRegistry.Status.Frozen));
        safe.payByName(address(usdc), acme, 1e6, "");
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.PayeeFrozen.selector, acme));
        safe.send(address(usdc), acmeKey, 1e6, "");
    }

    function test_SendToVerifiedIsDirect() public {
        vm.prank(payer);
        (bool escrowed,) = safe.send(address(usdc), acmeKey, 5e6, "");
        assertFalse(escrowed);
        assertEq(usdc.balanceOf(acmeKey), 5e6);
    }

    /// The demo: poisoned address -> escrow -> Undo -> money back.
    function testFuzz_LookalikeEscrowedAndUndone(uint256 salt, uint256 amount) public {
        amount = bound(amount, 1, usdc.balanceOf(payer));
        address poisoned = _lookalike(acmeKey, salt);
        uint256 before = usdc.balanceOf(payer);
        vm.prank(payer);
        (bool escrowed, uint256 id) = safe.send(address(usdc), poisoned, amount, "");
        assertTrue(escrowed);
        assertEq(usdc.balanceOf(poisoned), 0);
        vm.prank(payer);
        safe.cancel(id);
        assertEq(usdc.balanceOf(payer), before);
        assertEq(safe.totalEscrowed(address(usdc)), 0);
    }

    function testFuzz_RevertWhen_CancelAfterWindow(uint64 extra) public {
        address stranger = makeAddr("stranger");
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), stranger, 1e6, "");
        vm.warp(block.timestamp + WINDOW + uint64(bound(extra, 0, 365 days)));
        vm.prank(payer);
        vm.expectRevert();
        safe.cancel(id);
    }

    function testFuzz_RevertWhen_ReleaseBeforeWindow(uint64 elapsed) public {
        address stranger = makeAddr("stranger");
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), stranger, 1e6, "");
        vm.warp(block.timestamp + bound(elapsed, 0, WINDOW - 1));
        vm.expectRevert();
        safe.release(id);
    }

    function test_RevertWhen_NonSenderCancels() public {
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), makeAddr("stranger"), 1e6, "");
        vm.prank(makeAddr("thief"));
        vm.expectRevert(SafeSend.NotSender.selector);
        safe.cancel(id);
    }

    function test_FirstTimeBecomesTrustedAfterRelease() public {
        address vendor = makeAddr("vendor");
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), vendor, 1e6, "");
        vm.warp(block.timestamp + WINDOW);
        safe.release(id);
        assertEq(usdc.balanceOf(vendor), 1e6);
        vm.prank(payer);
        (bool escrowed,) = safe.send(address(usdc), vendor, 2e6, "");
        assertFalse(escrowed);
    }

    function test_LookalikeNeverTrusted() public {
        address poisoned = _lookalike(acmeKey, 99);
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), poisoned, 1e6, "");
        vm.warp(block.timestamp + WINDOW);
        safe.release(id);
        vm.prank(payer);
        (bool escrowed,) = safe.send(address(usdc), poisoned, 1e6, "");
        assertTrue(escrowed);
    }

    function test_EurcEscrowAndUndo() public {
        eurc.mint(payer, 100e6);
        vm.startPrank(payer);
        eurc.approve(address(safe), type(uint256).max);
        (bool escrowed, uint256 id) = safe.send(address(eurc), _lookalike(acmeKey, 3), 50e6, "");
        assertTrue(escrowed);
        assertEq(safe.totalEscrowed(address(eurc)), 50e6);
        safe.cancel(id);
        vm.stopPrank();
        assertEq(eurc.balanceOf(payer), 100e6);
        assertEq(safe.totalEscrowed(address(eurc)), 0);
    }

    function test_RevertWhen_UnsupportedToken() public {
        address fake = makeAddr("fakeToken");
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.UnsupportedToken.selector, fake));
        safe.send(fake, makeAddr("x"), 1, "");
    }

    function test_RevertWhen_DoubleRelease() public {
        vm.prank(payer);
        (, uint256 id) = safe.send(address(usdc), makeAddr("v"), 1e6, "");
        vm.warp(block.timestamp + WINDOW);
        safe.release(id);
        vm.expectRevert(SafeSend.NotOpen.selector);
        safe.release(id);
    }
}

/// @dev Random sends, cancels, releases and time jumps against SafeSend.
contract Handler is Test {
    SafeSend safe;
    MockUSDC usdc;
    address[] senders;
    address[] recipients;
    uint256[] public ids;
    uint256 public totalIn;
    uint256 public totalOut;

    constructor(SafeSend _safe, MockUSDC _usdc, address[] memory _recipients) {
        safe = _safe;
        usdc = _usdc;
        recipients = _recipients;
        for (uint256 i; i < 3; ++i) {
            address s = address(uint160(0x5E0D0 + i));
            senders.push(s);
            usdc.mint(s, 1e15);
            vm.prank(s);
            usdc.approve(address(safe), type(uint256).max);
        }
    }

    function send(uint256 s, uint256 r, uint256 amount) external {
        amount = bound(amount, 1, 1e9);
        vm.prank(senders[s % senders.length]);
        (bool escrowed, uint256 id) = safe.send(address(usdc), recipients[r % recipients.length], amount, "");
        if (escrowed) {
            ids.push(id);
            totalIn += amount;
        }
    }

    function cancel(uint256 i) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        (, address sender,, uint128 amount, uint64 releaseAt,, bool open) = safe.pendings(id);
        if (!open || block.timestamp >= releaseAt) return;
        vm.prank(sender);
        safe.cancel(id);
        totalOut += amount;
    }

    function release(uint256 i) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        (,,, uint128 amount, uint64 releaseAt,, bool open) = safe.pendings(id);
        if (!open || block.timestamp < releaseAt) return;
        safe.release(id);
        totalOut += amount;
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 0, 20 minutes));
    }

    function sumOpen() external view returns (uint256 sum) {
        for (uint256 i; i < ids.length; ++i) {
            (,,, uint128 amount,,, bool open) = safe.pendings(ids[i]);
            if (open) sum += amount;
        }
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }
}

contract SafeSendInvariants is Base {
    Handler h;

    function setUp() public override {
        super.setUp();
        _register("acme.com", acmeKey);
        address[] memory rs = new address[](4);
        rs[0] = acmeKey; // verified: paid directly
        rs[1] = _lookalike(acmeKey, 1); // poisoned: always escrowed
        rs[2] = makeAddr("vendorA"); // first-time
        rs[3] = makeAddr("vendorB");
        h = new Handler(safe, usdc, rs);
        targetContract(address(h));
    }

    /// Escrow is always fully backed, and the books match the open escrows.
    function invariant_EscrowFullyBacked() public view {
        assertEq(usdc.balanceOf(address(safe)), safe.totalEscrowed(address(usdc)));
        assertEq(h.sumOpen(), safe.totalEscrowed(address(usdc)));
    }

    /// Nothing ever leaves escrow that did not go in.
    function invariant_OutNeverExceedsIn() public view {
        assertLe(h.totalOut(), h.totalIn());
        assertEq(h.totalIn() - h.totalOut(), safe.totalEscrowed(address(usdc)));
    }
}
