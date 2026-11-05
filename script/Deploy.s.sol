// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {SafeSend} from "../src/SafeSend.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast --private-key $PK
contract Deploy is Script {
    // Arc Testnet (chain 5042002)
    address constant CRE_SIM_FORWARDER = 0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1; // MockKeystoneForwarder (simulate --broadcast)
    address constant USDC = 0x3600000000000000000000000000000000000000; // USDC ERC-20 interface, 6 decimals
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a; // EURC, 6 decimals

    function run() external {
        address approvalSigner = vm.envAddress("APPROVAL_SIGNER"); // backend key that signs after Agent Pass
        uint64 delay = uint64(vm.envOr("CHANGE_DELAY", uint256(120))); // 2 min demo, 48h production
        uint64 window = uint64(vm.envOr("UNDO_WINDOW", uint256(600))); // 10 min
        vm.startBroadcast();
        PayeeRegistry reg = new PayeeRegistry(CRE_SIM_FORWARDER, address(0), approvalSigner, delay);
        address[] memory toks = new address[](2);
        toks[0] = USDC;
        toks[1] = EURC;
        SafeSend safe = new SafeSend(reg, toks, window);
        // Demo agent wallet: owner = deployer, agent = AGENT_ADDRESS (optional)
        address agent = vm.envOr("AGENT_ADDRESS", address(0));
        AgentWallet wallet = new AgentWallet(reg, msg.sender, agent, approvalSigner);
        vm.stopBroadcast();
        console.log("AgentWallet", address(wallet));
        console.log("PayeeRegistry", address(reg));
        console.log("SafeSend", address(safe));
    }
}
