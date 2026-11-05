// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {SafeSend} from "../src/SafeSend.sol";

/// @dev Test-only 6-decimal token standing in for Arc's USDC ERC-20 interface.
contract MockUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender];
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        balanceOf[f] -= a;
        balanceOf[to] += a;
        return true;
    }
}

abstract contract Base is Test {
    PayeeRegistry reg;
    SafeSend safe;
    MockUSDC usdc;
    MockUSDC eurc;

    address forwarder = makeAddr("forwarder");
    uint256 signerPk = 0xA11CE;
    address signer;
    address acmeKey = address((uint160(0x8F4a) << 144) | uint160(0x91B2)); // 0x8F4a...91B2: controller + first payout
    address payer = makeAddr("payer");
    bytes32 acme = keccak256("acme.com");

    uint64 constant DELAY = 2 minutes;
    uint64 constant WINDOW = 10 minutes;

    function setUp() public virtual {
        signer = vm.addr(signerPk);
        reg = new PayeeRegistry(forwarder, address(0), signer, DELAY);
        usdc = new MockUSDC();
        eurc = new MockUSDC();
        address[] memory toks = new address[](2);
        toks[0] = address(usdc);
        toks[1] = address(eurc);
        safe = new SafeSend(reg, toks, WINDOW);
        usdc.mint(payer, 1_000_000e6);
        vm.prank(payer);
        usdc.approve(address(safe), type(uint256).max);
    }

    // ---------------------------------------------------------- helpers
    function _report(bytes32 d, address controller, uint8 action) internal {
        vm.prank(forwarder);
        reg.onReport("", abi.encode(d, controller, bytes32(0), action));
    }

    function _register(string memory domain, address controller) internal returns (bytes32 d) {
        d = reg.requestRegistration(domain);
        _report(d, controller, reg.ACTION_VERIFY());
    }

    /// @dev Same first 4 + last 4 hex chars as `a`, different middle.
    function _lookalike(address a, uint256 salt) internal pure returns (address) {
        uint160 keep = (uint160(0xFFFF) << 144) | uint160(0xFFFF);
        uint160 mid = uint160(uint256(keccak256(abi.encode(salt)))) & ~keep;
        address l = address((uint160(a) & keep) | mid);
        return l == a ? address(uint160(l) ^ (uint160(1) << 80)) : l;
    }

    function _approval(bytes32 d, address newPayout, uint256 nonce, uint256 deadline, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                reg.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(reg.PAYOUT_CHANGE_TYPEHASH(), d, newPayout, nonce, deadline))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
