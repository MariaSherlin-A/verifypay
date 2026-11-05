// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {PayeeRegistry, IReceiver} from "../src/PayeeRegistry.sol";

contract PayeeRegistryTest is Base {
    function test_VerifyFlow() public {
        bytes32 d = _register("acme.com", acmeKey);
        assertEq(d, acme);
        (address payout, PayeeRegistry.Status s) = reg.resolveName("acme.com");
        assertEq(payout, acmeKey);
        assertEq(uint8(s), uint8(PayeeRegistry.Status.Active));
    }

    function testFuzz_RevertWhen_ReportNotFromForwarder(address caller) public {
        vm.assume(caller != forwarder);
        reg.requestRegistration("acme.com");
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.UnauthorizedForwarder.selector, caller));
        reg.onReport("", abi.encode(acme, acmeKey, bytes32(0), uint8(1)));
    }

    function test_RevertWhen_ReportForUnrequestedDomain() public {
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.UnknownDomain.selector, acme));
        reg.onReport("", abi.encode(acme, acmeKey, bytes32(0), uint8(1)));
    }

    function test_RevertWhen_InvalidDomain() public {
        vm.expectRevert(PayeeRegistry.InvalidDomain.selector);
        reg.requestRegistration("Acme.com");
        vm.expectRevert(PayeeRegistry.InvalidDomain.selector);
        reg.requestRegistration("acmecom");
    }

    function test_FreezeThenReverifyUnfreezes() public {
        _register("acme.com", acmeKey);
        _report(acme, acmeKey, reg.ACTION_FREEZE());
        (, PayeeRegistry.Status s) = reg.resolve(acme);
        assertEq(uint8(s), uint8(PayeeRegistry.Status.Frozen));
        _report(acme, acmeKey, reg.ACTION_VERIFY());
        (, s) = reg.resolve(acme);
        assertEq(uint8(s), uint8(PayeeRegistry.Status.Active));
    }

    /// DNS hijack: a report naming a new controller freezes and only queues it.
    function test_DnsControllerChangeFreezesAndDelays() public {
        _register("acme.com", acmeKey);
        address hijacker = makeAddr("hijacker");
        _report(acme, hijacker, reg.ACTION_VERIFY());

        PayeeRegistry.Payee memory p = reg.getPayee(acme);
        assertEq(uint8(p.status), uint8(PayeeRegistry.Status.Frozen));
        assertEq(p.controller, acmeKey);
        assertEq(p.payout, acmeKey);
        assertEq(p.pendingController, hijacker);

        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.TooEarly.selector, p.controllerEta));
        reg.executeControllerChange(acme);

        // Real owner kills it.
        vm.prank(acmeKey);
        reg.cancelControllerChange(acme);
        assertEq(reg.getPayee(acme).pendingController, address(0));
    }

    function test_LookalikeRegistrationRejected() public {
        _register("acme.com", acmeKey);
        address evil = _lookalike(acmeKey, 1);
        bytes32 d = reg.requestRegistration("acrne.com");
        _report(d, evil, reg.ACTION_VERIFY());
        PayeeRegistry.Payee memory p = reg.getPayee(d);
        assertEq(uint8(p.status), uint8(PayeeRegistry.Status.Pending)); // not verified
        assertEq(reg.fingerprintOwner(reg.fingerprint(acmeKey)), acmeKey); // index not overwritten
    }

    function testFuzz_InspectFlagsLookalike(uint256 salt) public {
        _register("acme.com", acmeKey);
        address l = _lookalike(acmeKey, salt);
        (PayeeRegistry.Verdict v, bytes32 d, address imitated) = reg.inspectRecipient(l);
        assertEq(uint8(v), uint8(PayeeRegistry.Verdict.Lookalike));
        assertEq(d, acme);
        assertEq(imitated, acmeKey);
    }

    // ------------------------------------------------- payout rotation
    function test_PayoutChangeHappyPath() public {
        _register("acme.com", acmeKey);
        address newPayout = makeAddr("newPayout");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _approval(acme, newPayout, 0, deadline, signerPk);

        vm.prank(acmeKey);
        reg.requestPayoutChange(acme, newPayout, deadline, sig);
        // Old wallet still receives during the delay.
        (address payout,) = reg.resolve(acme);
        assertEq(payout, acmeKey);

        vm.warp(block.timestamp + DELAY);
        reg.executePayoutChange(acme);
        (payout,) = reg.resolve(acme);
        assertEq(payout, newPayout);
        assertEq(reg.payoutToDomain(acmeKey), bytes32(0));
    }

    function testFuzz_RevertWhen_ApprovalNotFromSigner(uint256 pk) public {
        pk = bound(pk, 1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140);
        vm.assume(pk != signerPk);
        _register("acme.com", acmeKey);
        address newPayout = makeAddr("newPayout");
        bytes memory sig = _approval(acme, newPayout, 0, block.timestamp + 1, pk);
        vm.prank(acmeKey);
        vm.expectRevert(PayeeRegistry.BadSignature.selector);
        reg.requestPayoutChange(acme, newPayout, block.timestamp + 1, sig);
    }

    function test_RevertWhen_ApprovalReplayed() public {
        _register("acme.com", acmeKey);
        address newPayout = makeAddr("newPayout");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _approval(acme, newPayout, 0, deadline, signerPk);
        vm.startPrank(acmeKey);
        reg.requestPayoutChange(acme, newPayout, deadline, sig);
        reg.cancelPayoutChange(acme);
        vm.expectRevert(PayeeRegistry.BadSignature.selector); // nonce moved on
        reg.requestPayoutChange(acme, newPayout, deadline, sig);
        vm.stopPrank();
    }

    function testFuzz_RevertWhen_ExecuteBeforeDelay(uint64 elapsed) public {
        elapsed = uint64(bound(elapsed, 0, DELAY - 1));
        _register("acme.com", acmeKey);
        address newPayout = makeAddr("newPayout");
        bytes memory sig = _approval(acme, newPayout, 0, block.timestamp + 1, signerPk);
        vm.prank(acmeKey);
        reg.requestPayoutChange(acme, newPayout, block.timestamp + 1, sig);
        vm.warp(block.timestamp + elapsed);
        vm.expectRevert();
        reg.executePayoutChange(acme);
    }

    function test_OldPayoutWalletCanCancel() public {
        address controller = makeAddr("controller");
        _register("acme.com", controller);
        address newPayout = makeAddr("newPayout");
        bytes memory sig = _approval(acme, newPayout, 0, block.timestamp + 1, signerPk);
        vm.prank(controller);
        reg.requestPayoutChange(acme, newPayout, block.timestamp + 1, sig);
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(PayeeRegistry.NotAuthorized.selector);
        reg.cancelPayoutChange(acme);
        vm.prank(controller); // controller == current payout here
        reg.cancelPayoutChange(acme);
    }

    function test_RevertWhen_NewPayoutIsLookalike() public {
        _register("acme.com", acmeKey);
        bytes32 d2 = _register("globex.com", makeAddr("globex"));
        address l = _lookalike(acmeKey, 7);
        bytes memory sig = _approval(d2, l, 0, block.timestamp + 1, signerPk);
        vm.prank(makeAddr("globex"));
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.LookalikeCollision.selector, acmeKey));
        reg.requestPayoutChange(d2, l, block.timestamp + 1, sig);
    }

    function test_DomainEnumeration() public {
        _register("acme.com", acmeKey);
        reg.requestRegistration("acme.com"); // re-request does not duplicate
        reg.requestRegistration("globex.com");
        assertEq(reg.domainCount(), 2);
        (bytes32 d, string memory name, PayeeRegistry.Status s) = reg.domainAt(0);
        assertEq(d, acme);
        assertEq(name, "acme.com");
        assertEq(uint8(s), uint8(PayeeRegistry.Status.Active));
    }

    function testFuzz_AuthorCheck(address wrongOwner) public {
        address owner = makeAddr("workflowOwner");
        vm.assume(wrongOwner != owner);
        PayeeRegistry r = new PayeeRegistry(forwarder, owner, signer, DELAY);
        r.requestRegistration("acme.com");
        bytes memory report = abi.encode(acme, acmeKey, bytes32(0), uint8(1));
        bytes memory badMeta = abi.encodePacked(bytes32("wf"), bytes10("verifypay"), wrongOwner);
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.InvalidAuthor.selector, wrongOwner, owner));
        r.onReport(badMeta, report);
        vm.prank(forwarder);
        r.onReport(abi.encodePacked(bytes32("wf"), bytes10("verifypay"), owner), report);
        (address payout,) = r.resolve(acme);
        assertEq(payout, acmeKey);
    }

    function test_SupportsInterface() public view {
        assertTrue(reg.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(reg.supportsInterface(0x01ffc9a7)); // IERC165
    }
}
