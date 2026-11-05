// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayeeRegistry} from "./PayeeRegistry.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SafeSend
/// @notice One payment entry point for USDC on Arc.
///         - Verified, active payees settle instantly.
///         - Frozen payees cannot be paid.
///         - Look-alike (poisoned) and first-time unverified recipients go into a reversible escrow:
///           the sender can cancel until `releaseAt`; anyone can release it to the recipient after.
/// @dev Uses ERC-20 interfaces only (USDC 0x3600...0000 and EURC on Arc, 6 decimals), never native msg.value.
contract SafeSend {
    enum Reason {
        FirstTime, // unverified recipient the sender has never completed a payment to
        Lookalike // recipient imitates a registered payout (address poisoning)
    }

    struct Pending {
        address token;
        address sender;
        address to;
        uint128 amount;
        uint64 releaseAt;
        Reason reason;
        bool open;
    }

    PayeeRegistry public immutable registry;
    uint64 public immutable undoWindow;

    /// @notice Stablecoins accepted (USDC and EURC on Arc), fixed at deploy.
    mapping(address => bool) public supportedToken;
    address[] public tokens;

    uint256 public nextId;
    /// @notice token => amount currently held in escrow
    mapping(address => uint256) public totalEscrowed;
    mapping(uint256 => Pending) public pendings;
    /// @notice sender => recipient => true once an escrowed first-time payment was released.
    mapping(address => mapping(address => bool)) public trusted;

    uint256 private _lock = 1;

    event Paid(
        address token, address indexed sender, address indexed to, uint256 amount, bytes32 indexed domainHash, bytes32 ref
    );
    event Escrowed(
        uint256 indexed id,
        address token,
        address indexed sender,
        address indexed to,
        uint256 amount,
        Reason reason,
        address imitated,
        uint64 releaseAt,
        bytes32 ref
    );
    event Cancelled(uint256 indexed id, address indexed sender, uint256 amount);
    event Released(uint256 indexed id, address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error AmountTooLarge();
    error PayeeNotActive(PayeeRegistry.Status status);
    error PayeeFrozen(bytes32 domainHash);
    error NotOpen();
    error NotSender();
    error WindowOver(uint64 releaseAt);
    error WindowOpen(uint64 releaseAt);
    error TransferFailed();
    error Reentrancy();
    error UnsupportedToken(address token);

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(PayeeRegistry _registry, address[] memory _tokens, uint64 _undoWindow) {
        if (address(_registry) == address(0) || _tokens.length == 0) revert ZeroAddress();
        registry = _registry;
        undoWindow = _undoWindow;
        for (uint256 i; i < _tokens.length; ++i) {
            if (_tokens[i] == address(0)) revert ZeroAddress();
            supportedToken[_tokens[i]] = true;
            tokens.push(_tokens[i]);
        }
    }

    modifier onlySupported(address token) {
        if (!supportedToken[token]) revert UnsupportedToken(token);
        _;
    }

    /// @notice Pay a verified business by domain hash. Reverts unless the payee is Active.
    function payByName(address token, bytes32 domainHash, uint256 amount, bytes32 ref)
        external
        nonReentrant
        onlySupported(token)
    {
        if (amount == 0) revert ZeroAmount();
        (address payout, PayeeRegistry.Status status) = registry.resolve(domainHash);
        if (status != PayeeRegistry.Status.Active) revert PayeeNotActive(status);
        _pull(token, msg.sender, payout, amount);
        emit Paid(token, msg.sender, payout, amount, domainHash, ref);
    }

    /// @notice Pay any address. Risky recipients are escrowed instead of paid.
    /// @return escrowed true if the payment went into the undo escrow
    /// @return id escrow id (0 if paid directly)
    function send(address token, address to, uint256 amount, bytes32 ref)
        external
        nonReentrant
        onlySupported(token)
        returns (bool escrowed, uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        (PayeeRegistry.Verdict verdict, bytes32 d, address imitated) = registry.inspectRecipient(to);

        if (verdict == PayeeRegistry.Verdict.Frozen) revert PayeeFrozen(d);
        if (verdict == PayeeRegistry.Verdict.Verified) {
            _pull(token, msg.sender, to, amount);
            emit Paid(token, msg.sender, to, amount, d, ref);
            return (false, 0);
        }
        if (verdict == PayeeRegistry.Verdict.Unknown && trusted[msg.sender][to]) {
            _pull(token, msg.sender, to, amount);
            emit Paid(token, msg.sender, to, amount, bytes32(0), ref);
            return (false, 0);
        }

        Reason reason = verdict == PayeeRegistry.Verdict.Lookalike ? Reason.Lookalike : Reason.FirstTime;
        id = _escrow(token, to, amount, reason, imitated, ref);
        return (true, id);
    }

    function _escrow(address token, address to, uint256 amount, Reason reason, address imitated, bytes32 ref)
        internal
        returns (uint256 id)
    {
        if (amount > type(uint128).max) revert AmountTooLarge();
        id = ++nextId;
        uint64 releaseAt = uint64(block.timestamp) + undoWindow;
        pendings[id] = Pending(token, msg.sender, to, uint128(amount), releaseAt, reason, true);
        totalEscrowed[token] += amount;
        _pull(token, msg.sender, address(this), amount);
        emit Escrowed(id, token, msg.sender, to, amount, reason, imitated, releaseAt, ref);
    }

    /// @notice Undo: the sender takes the USDC back before the window ends.
    function cancel(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        if (!p.open) revert NotOpen();
        if (msg.sender != p.sender) revert NotSender();
        if (block.timestamp >= p.releaseAt) revert WindowOver(p.releaseAt);
        p.open = false;
        uint256 amount = p.amount;
        totalEscrowed[p.token] -= amount;
        _push(p.token, p.sender, amount);
        emit Cancelled(id, p.sender, amount);
    }

    /// @notice After the window, anyone can deliver the payment to the recipient.
    function release(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        if (!p.open) revert NotOpen();
        if (block.timestamp < p.releaseAt) revert WindowOpen(p.releaseAt);
        p.open = false;
        uint256 amount = p.amount;
        totalEscrowed[p.token] -= amount;
        // A look-alike is never auto-trusted, even after a completed payment.
        if (p.reason == Reason.FirstTime) trusted[p.sender][p.to] = true;
        _push(p.token, p.to, amount);
        emit Released(id, p.to, amount);
    }

    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    function _pull(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!_ok(success, data)) revert TransferFailed();
    }

    function _push(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!_ok(success, data)) revert TransferFailed();
    }

    /// @dev Accepts tokens that return true or nothing; rejects false or a revert.
    function _ok(bool success, bytes memory data) private pure returns (bool) {
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}
