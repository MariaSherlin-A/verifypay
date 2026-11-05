// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayeeRegistry} from "./PayeeRegistry.sol";

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title AgentWallet
/// @notice A stablecoin wallet an AI agent can spend from, but only to Active, CRE-verified businesses
///         (by domain, never by raw address), within per-payment and per-day caps.
///         Lowering limits is free; RAISING them needs a backend approval that is issued only after a
///         fresh World ID Agent Pass check by the human owner.
///         Software-to-software payments that cannot be redirected by a poisoned or swapped address.
contract AgentWallet {
    struct Limits {
        uint128 perPayment;
        uint128 perDay;
    }

    bytes32 public constant RAISE_LIMITS_TYPEHASH = keccak256(
        "RaiseLimits(address wallet,address token,uint128 perPayment,uint128 perDay,uint256 nonce,uint256 deadline)"
    );

    PayeeRegistry public immutable registry;
    address public immutable owner;
    address public immutable approvalSigner;
    bytes32 public immutable DOMAIN_SEPARATOR;

    address public agent;
    bool public paused;
    uint256 public nonce;
    mapping(address => Limits) public limits;
    /// @notice token => day index => amount spent
    mapping(address => mapping(uint256 => uint256)) public spent;

    event AgentSet(address agent);
    event Paused(bool paused);
    event LimitsSet(address indexed token, uint128 perPayment, uint128 perDay, bool raised);
    event AgentPaid(address indexed token, bytes32 indexed domainHash, address payout, uint256 amount, bytes32 ref);
    event Withdrawn(address indexed token, address to, uint256 amount);

    error NotOwner();
    error NotAgent();
    error IsPaused();
    error ZeroAddress();
    error ZeroAmount();
    error PayeeNotActive(PayeeRegistry.Status status);
    error OverPerPayment(uint256 amount, uint256 cap);
    error OverDaily(uint256 wouldSpend, uint256 cap);
    error NotARaise();
    error Expired();
    error BadSignature();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(PayeeRegistry _registry, address _owner, address _agent, address _approvalSigner) {
        if (address(_registry) == address(0) || _owner == address(0) || _approvalSigner == address(0)) {
            revert ZeroAddress();
        }
        registry = _registry;
        owner = _owner;
        agent = _agent;
        approvalSigner = _approvalSigner;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("VerifyPayAgentWallet"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
        emit AgentSet(_agent);
    }

    // ------------------------------------------------------------ agent
    /// @notice The agent pays a verified business by domain. No raw addresses, so nothing to poison.
    function agentPay(address token, bytes32 domainHash, uint256 amount, bytes32 ref) external {
        if (msg.sender != agent) revert NotAgent();
        if (paused) revert IsPaused();
        if (amount == 0) revert ZeroAmount();
        (address payout, PayeeRegistry.Status status) = registry.resolve(domainHash);
        if (status != PayeeRegistry.Status.Active) revert PayeeNotActive(status);

        Limits memory l = limits[token];
        if (amount > l.perPayment) revert OverPerPayment(amount, l.perPayment);
        uint256 day = block.timestamp / 1 days;
        uint256 total = spent[token][day] + amount;
        if (total > l.perDay) revert OverDaily(total, l.perDay);
        spent[token][day] = total;

        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20Min.transfer, (payout, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
        emit AgentPaid(token, domainHash, payout, amount, ref);
    }

    // ------------------------------------------------------------ owner
    function setAgent(address newAgent) external onlyOwner {
        agent = newAgent;
        emit AgentSet(newAgent);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    /// @notice Tightening needs no extra approval.
    function lowerLimits(address token, uint128 perPayment, uint128 perDay) external onlyOwner {
        Limits memory l = limits[token];
        if (perPayment > l.perPayment || perDay > l.perDay) revert NotARaise();
        limits[token] = Limits(perPayment, perDay);
        emit LimitsSet(token, perPayment, perDay, false);
    }

    /// @notice Raising the agent's spending power needs a fresh human approval (World ID Agent Pass,
    ///         validated by the backend, which then signs this EIP-712 message).
    function raiseLimits(address token, uint128 perPayment, uint128 perDay, uint256 deadline, bytes calldata sig)
        external
        onlyOwner
    {
        if (block.timestamp > deadline) revert Expired();
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(RAISE_LIMITS_TYPEHASH, address(this), token, perPayment, perDay, nonce++, deadline)
                )
            )
        );
        if (_recover(digest, sig) != approvalSigner) revert BadSignature();
        limits[token] = Limits(perPayment, perDay);
        emit LimitsSet(token, perPayment, perDay, true);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20Min.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
        emit Withdrawn(token, to, amount);
    }

    function spentToday(address token) external view returns (uint256) {
        return spent[token][block.timestamp / 1 days];
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
