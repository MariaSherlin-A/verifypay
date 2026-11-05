// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Chainlink CRE consumer interface (report delivered by the KeystoneForwarder).
interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title PayeeRegistry
/// @notice Domain-verified payees for stablecoin payments on Arc.
///         - Verification and freezing come only from a Chainlink CRE workflow (via the Forwarder).
///         - A DNS change to a new controller never takes effect instantly: it freezes the payee and
///           queues the new controller behind a public delay (DNS-hijack protection).
///         - Payout-wallet rotation needs the controller + a backend approval issued only after a fresh
///           World ID Agent Pass check, then a public delay. The current payout wallet can cancel.
///         - Every payout wallet is indexed by its address fingerprint (first 4 + last 4 hex chars) so
///           look-alike (address-poisoning) recipients can be detected on-chain by anyone.
contract PayeeRegistry is IReceiver, IERC165 {
    // ----------------------------------------------------------------- types
    enum Status {
        None, // never requested
        Pending, // registration requested, waiting for CRE verification
        Active, // verified, payable
        Frozen // verification lapsed / DNS changed / CRE freeze: not payable
    }

    enum Verdict {
        Unknown, // not a registered payout, no look-alike match
        Verified, // registered payout of an Active payee
        Frozen, // registered payout of a Frozen payee
        Lookalike // shares a fingerprint with a different registered payout
    }

    struct Payee {
        string domain;
        address controller; // key published in DNS TXT `_verifypay.<domain>`
        address payout; // where payments go
        bytes32 leiHash; // optional GLEIF LEI hash (0 if none)
        Status status;
        uint64 verifiedAt;
        address pendingPayout;
        uint64 payoutEta;
        address pendingController;
        uint64 controllerEta;
    }

    uint8 public constant ACTION_VERIFY = 1;
    uint8 public constant ACTION_FREEZE = 2;

    bytes32 public constant PAYOUT_CHANGE_TYPEHASH =
        keccak256("PayoutChange(bytes32 domainHash,address newPayout,uint256 nonce,uint256 deadline)");

    // ------------------------------------------------------------- storage
    address public immutable forwarder;
    /// @notice Expected CRE workflow owner (0 = skip; simulation). Same check as Chainlink's ReceiverTemplate.
    address public immutable expectedAuthor;
    address public immutable approvalSigner;
    uint64 public immutable changeDelay;
    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(bytes32 => Payee) internal _payees;
    mapping(address => bytes32) public payoutToDomain;
    mapping(bytes4 => address) public fingerprintOwner;
    mapping(bytes32 => uint256) public nonces;
    bytes32[] internal _domainList;

    // -------------------------------------------------------------- events
    event RegistrationRequested(bytes32 indexed domainHash, string domain, address indexed requester);
    event PayeeVerified(bytes32 indexed domainHash, address controller, address payout, bytes32 leiHash);
    event PayeeFrozen(bytes32 indexed domainHash, address payout);
    event VerificationRejected(bytes32 indexed domainHash, address controller, address collidesWith);
    event ControllerChangeQueued(bytes32 indexed domainHash, address newController, uint64 eta);
    event ControllerChanged(bytes32 indexed domainHash, address newController);
    event ControllerChangeCancelled(bytes32 indexed domainHash);
    event PayoutChangeQueued(bytes32 indexed domainHash, address newPayout, uint64 eta);
    event PayoutChanged(bytes32 indexed domainHash, address oldPayout, address newPayout);
    event PayoutChangeCancelled(bytes32 indexed domainHash, address by);

    // -------------------------------------------------------------- errors
    error UnauthorizedForwarder(address caller);
    error InvalidAuthor(address received, address expected);
    error InvalidDomain();
    error UnknownDomain(bytes32 domainHash);
    error BadAction(uint8 action);
    error ZeroAddress();
    error NotController();
    error NotActive();
    error Expired();
    error BadSignature();
    error LookalikeCollision(address existing);
    error PayoutInUse(address payout);
    error NothingPending();
    error TooEarly(uint64 eta);
    error NotAuthorized();

    constructor(address _forwarder, address _expectedAuthor, address _approvalSigner, uint64 _changeDelay) {
        if (_forwarder == address(0) || _approvalSigner == address(0)) revert ZeroAddress();
        forwarder = _forwarder;
        expectedAuthor = _expectedAuthor;
        approvalSigner = _approvalSigner;
        changeDelay = _changeDelay;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("VerifyPay"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    // ------------------------------------------------------ registration
    /// @notice Ask CRE to verify `domain`. The domain must already publish
    ///         TXT `_verifypay.<domain>` = `arc:<controller address>`.
    function requestRegistration(string calldata domain) external returns (bytes32 domainHash) {
        if (!_validDomain(bytes(domain))) revert InvalidDomain();
        domainHash = keccak256(bytes(domain));
        Payee storage p = _payees[domainHash];
        if (p.status == Status.None) {
            p.domain = domain;
            p.status = Status.Pending;
            _domainList.push(domainHash);
        }
        emit RegistrationRequested(domainHash, domain, msg.sender);
    }

    // ------------------------------------------------------- CRE reports
    /// @inheritdoc IReceiver
    /// @dev report = abi.encode(bytes32 domainHash, address controller, bytes32 leiHash, uint8 action)
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert UnauthorizedForwarder(msg.sender);
        if (expectedAuthor != address(0)) {
            address author = _workflowOwner(metadata);
            if (author != expectedAuthor) revert InvalidAuthor(author, expectedAuthor);
        }
        (bytes32 d, address controller, bytes32 leiHash, uint8 action) =
            abi.decode(report, (bytes32, address, bytes32, uint8));
        Payee storage p = _payees[d];
        if (p.status == Status.None) revert UnknownDomain(d);

        if (action == ACTION_VERIFY) {
            _onVerify(d, p, controller, leiHash);
        } else if (action == ACTION_FREEZE) {
            if (p.status == Status.Active) {
                p.status = Status.Frozen;
                emit PayeeFrozen(d, p.payout);
            }
        } else {
            revert BadAction(action);
        }
    }

    function _onVerify(bytes32 d, Payee storage p, address controller, bytes32 leiHash) internal {
        if (controller == address(0)) revert ZeroAddress();

        if (p.status == Status.Pending) {
            // First verification: the DNS controller also becomes the first payout wallet.
            address clash = _clash(controller);
            if (clash != address(0) || payoutToDomain[controller] != bytes32(0)) {
                // Never revert inside a CRE delivery: record the rejection instead.
                emit VerificationRejected(d, controller, clash);
                return;
            }
            p.controller = controller;
            _bindPayout(d, p, controller);
        } else if (controller != p.controller) {
            // DNS now points to a different key: possible domain hijack.
            // Freeze immediately and only allow the new key after a public delay.
            if (p.status == Status.Active) emit PayeeFrozen(d, p.payout);
            p.status = Status.Frozen;
            if (p.pendingController != controller) {
                p.pendingController = controller;
                p.controllerEta = uint64(block.timestamp) + changeDelay;
                emit ControllerChangeQueued(d, controller, p.controllerEta);
            }
            return;
        }

        // DNS confirms the current controller again: drop any key queued by an earlier hijack,
        // otherwise anyone could execute it after the delay while the payee is Active.
        if (p.pendingController != address(0)) {
            p.pendingController = address(0);
            p.controllerEta = 0;
            emit ControllerChangeCancelled(d);
        }

        p.leiHash = leiHash;
        p.status = Status.Active;
        p.verifiedAt = uint64(block.timestamp);
        emit PayeeVerified(d, p.controller, p.payout, leiHash);
    }

    // ------------------------------------------------ controller rotation
    /// @notice After the delay, the DNS-published key becomes controller. The payee stays Frozen
    ///         until the next CRE verification confirms the same key.
    function executeControllerChange(bytes32 d) external {
        Payee storage p = _payees[d];
        if (p.pendingController == address(0)) revert NothingPending();
        if (block.timestamp < p.controllerEta) revert TooEarly(p.controllerEta);
        p.controller = p.pendingController;
        p.pendingController = address(0);
        p.controllerEta = 0;
        emit ControllerChanged(d, p.controller);
    }

    /// @notice The current controller (the real owner) can kill a queued DNS-driven change.
    function cancelControllerChange(bytes32 d) external {
        Payee storage p = _payees[d];
        if (msg.sender != p.controller) revert NotController();
        if (p.pendingController == address(0)) revert NothingPending();
        p.pendingController = address(0);
        p.controllerEta = 0;
        emit ControllerChangeCancelled(d);
    }

    // ---------------------------------------------------- payout rotation
    /// @param sig EIP-712 signature by `approvalSigner`, issued by the backend only after it has
    ///        validated a fresh World ID Agent Pass result for this exact change.
    function requestPayoutChange(bytes32 d, address newPayout, uint256 deadline, bytes calldata sig) external {
        Payee storage p = _payees[d];
        if (msg.sender != p.controller) revert NotController();
        if (p.status != Status.Active) revert NotActive();
        if (block.timestamp > deadline) revert Expired();
        if (newPayout == address(0)) revert ZeroAddress();
        if (payoutToDomain[newPayout] != bytes32(0)) revert PayoutInUse(newPayout);
        address clash = _clash(newPayout);
        if (clash != address(0)) revert LookalikeCollision(clash);

        uint256 nonce = nonces[d]++;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PAYOUT_CHANGE_TYPEHASH, d, newPayout, nonce, deadline))
            )
        );
        if (_recover(digest, sig) != approvalSigner) revert BadSignature();

        p.pendingPayout = newPayout;
        p.payoutEta = uint64(block.timestamp) + changeDelay;
        emit PayoutChangeQueued(d, newPayout, p.payoutEta);
    }

    function executePayoutChange(bytes32 d) external {
        Payee storage p = _payees[d];
        if (p.pendingPayout == address(0)) revert NothingPending();
        if (block.timestamp < p.payoutEta) revert TooEarly(p.payoutEta);
        if (p.status != Status.Active) revert NotActive();
        address newPayout = p.pendingPayout;
        // Re-check: something may have claimed the fingerprint during the delay.
        address clash = _clash(newPayout);
        if (clash != address(0)) revert LookalikeCollision(clash);
        if (payoutToDomain[newPayout] != bytes32(0)) revert PayoutInUse(newPayout);

        address old = p.payout;
        delete payoutToDomain[old];
        if (fingerprintOwner[fingerprint(old)] == old) delete fingerprintOwner[fingerprint(old)];
        p.pendingPayout = address(0);
        p.payoutEta = 0;
        _bindPayout(d, p, newPayout);
        emit PayoutChanged(d, old, newPayout);
    }

    /// @notice Kill-switch: the controller or the CURRENT payout wallet can cancel a queued change.
    function cancelPayoutChange(bytes32 d) external {
        Payee storage p = _payees[d];
        if (msg.sender != p.controller && msg.sender != p.payout) revert NotAuthorized();
        if (p.pendingPayout == address(0)) revert NothingPending();
        p.pendingPayout = address(0);
        p.payoutEta = 0;
        emit PayoutChangeCancelled(d, msg.sender);
    }

    // --------------------------------------------------------------- views
    function resolve(bytes32 d) external view returns (address payout, Status status) {
        Payee storage p = _payees[d];
        return (p.payout, p.status);
    }

    function resolveName(string calldata domain) external view returns (address payout, Status status) {
        Payee storage p = _payees[keccak256(bytes(domain))];
        return (p.payout, p.status);
    }

    function getPayee(bytes32 d) external view returns (Payee memory) {
        return _payees[d];
    }

    /// @notice Used by the CRE cron job to re-check every registered payee.
    function domainCount() external view returns (uint256) {
        return _domainList.length;
    }

    function domainAt(uint256 i) external view returns (bytes32 domainHash, string memory domain, Status status) {
        domainHash = _domainList[i];
        Payee storage p = _payees[domainHash];
        return (domainHash, p.domain, p.status);
    }

    /// @notice Reusable firewall check for any wallet, agent or dApp on Arc.
    function inspectRecipient(address recipient)
        external
        view
        returns (Verdict verdict, bytes32 domainHash, address imitated)
    {
        domainHash = payoutToDomain[recipient];
        if (domainHash != bytes32(0)) {
            Status s = _payees[domainHash].status;
            return (s == Status.Active ? Verdict.Verified : Verdict.Frozen, domainHash, address(0));
        }
        address owner = fingerprintOwner[fingerprint(recipient)];
        if (owner != address(0) && owner != recipient) {
            return (Verdict.Lookalike, payoutToDomain[owner], owner);
        }
        return (Verdict.Unknown, bytes32(0), address(0));
    }

    /// @notice First 4 hex chars + last 4 hex chars of an address, the part people actually check.
    function fingerprint(address a) public pure returns (bytes4) {
        uint160 v = uint160(a);
        return bytes4((uint32(uint16(v >> 144)) << 16) | uint32(uint16(v)));
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    // ------------------------------------------------------------ internal
    /// @dev Returns the different wallet already holding `w`'s fingerprint, or 0.
    function _clash(address w) internal view returns (address) {
        address owner = fingerprintOwner[fingerprint(w)];
        return (owner != address(0) && owner != w) ? owner : address(0);
    }

    function _bindPayout(bytes32 d, Payee storage p, address w) internal {
        p.payout = w;
        payoutToDomain[w] = d;
        fingerprintOwner[fingerprint(w)] = w;
    }

    /// @dev Lowercase a-z, 0-9, '-' and '.', 3..253 chars, must contain a dot.
    function _validDomain(bytes memory b) internal pure returns (bool) {
        if (b.length < 3 || b.length > 253) return false;
        bool dot;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == ".") {
                if (i == 0 || i == b.length - 1) return false;
                dot = true;
            } else if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-")) {
                return false;
            }
        }
        return dot;
    }

    /// @dev metadata = workflowId (32) | workflowName (10) | workflowOwner (20), as in ReceiverTemplate.
    function _workflowOwner(bytes calldata metadata) internal pure returns (address owner) {
        if (metadata.length < 62) return address(0);
        owner = address(bytes20(metadata[42:62]));
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // Reject malleable signatures (EIP-2).
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
