// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// Proves the backend's EIP-712 type definitions (server/src/approval.js, eth_signTypedData_v4 JSON)
/// produce exactly the digests the contracts verify.
contract Eip712CompatTest is Base {
    function test_PayoutChangeJsonMatchesContract() public {
        _register("acme.com", acmeKey);
        address newPayout = makeAddr("newPayout");
        uint256 deadline = 1_900_000_000;
        string memory json = string.concat(
            '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],',
            '"PayoutChange":[{"name":"domainHash","type":"bytes32"},{"name":"newPayout","type":"address"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]},',
            '"primaryType":"PayoutChange","domain":{"name":"VerifyPay","version":"1","chainId":',
            vm.toString(block.chainid),
            ',"verifyingContract":"',
            vm.toString(address(reg)),
            '"},"message":{"domainHash":"',
            vm.toString(acme),
            '","newPayout":"',
            vm.toString(newPayout),
            '","nonce":0,"deadline":',
            vm.toString(deadline),
            "}}"
        );
        bytes32 digest = vm.eip712HashTypedData(json);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        vm.warp(deadline - 100);
        vm.prank(acmeKey);
        reg.requestPayoutChange(acme, newPayout, deadline, abi.encodePacked(r, s, v)); // reverts if types differ
        assertEq(reg.getPayee(acme).pendingPayout, newPayout);
    }

    function test_RaiseLimitsJsonMatchesContract() public {
        address owner = makeAddr("owner");
        AgentWallet w = new AgentWallet(reg, owner, makeAddr("agent"), signer);
        uint256 deadline = 1_900_000_000;
        string memory json = string.concat(
            '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],',
            '"RaiseLimits":[{"name":"wallet","type":"address"},{"name":"token","type":"address"},{"name":"perPayment","type":"uint128"},{"name":"perDay","type":"uint128"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]},',
            '"primaryType":"RaiseLimits","domain":{"name":"VerifyPayAgentWallet","version":"1","chainId":',
            vm.toString(block.chainid),
            ',"verifyingContract":"',
            vm.toString(address(w)),
            '"},"message":{"wallet":"',
            vm.toString(address(w)),
            '","token":"',
            vm.toString(address(usdc)),
            '","perPayment":100000000,"perDay":300000000,"nonce":0,"deadline":',
            vm.toString(deadline),
            "}}"
        );
        bytes32 digest = vm.eip712HashTypedData(json);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        vm.warp(deadline - 100);
        vm.prank(owner);
        w.raiseLimits(address(usdc), 100e6, 300e6, deadline, abi.encodePacked(r, s, v));
        (uint128 per, uint128 day) = w.limits(address(usdc));
        assertEq(per, 100e6);
        assertEq(day, 300e6);
    }
}
