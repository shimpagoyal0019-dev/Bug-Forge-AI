// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BugForgeEscrow {

    // ─── ENUMS ───────────────────────────────────────────
    enum Status {
        Pending,     // hacker submitted, waiting for org
        Locked,      // org locked ETH in escrow
        Released,    // verified, ETH sent to hacker
        Disputed,    // hacker raised dispute
        Refunded     // admin ruled in org's favour
    }

    // ─── STRUCTS ─────────────────────────────────────────
    struct BountyReport {
        uint256 id;
        address payable hacker;
        address payable organization;
        uint256 amount;          // ETH locked in wei
        uint256 minBounty;       // AI recommended minimum in wei
        Status  status;
        string  reportHash;      // IPFS hash of encrypted report
        uint256 createdAt;
        uint256 deadline;
    }

    // ─── STATE VARIABLES ─────────────────────────────────
    address public admin;
    uint256 public platformFeePercent = 2;
    uint256 public reportCount;

    mapping(uint256 => BountyReport) public reports;

    // ─── EVENTS ──────────────────────────────────────────
    event ReportCreated(
        uint256 indexed id,
        address indexed hacker,
        uint256 minBounty
    );

    event BountyLocked(
        uint256 indexed id,
        address indexed organization,
        uint256 amount
    );

    event BountyReleased(
        uint256 indexed id,
        address indexed hacker,
        uint256 amount
    );

    event DisputeRaised(
        uint256 indexed id,
        address indexed hacker
    );

    event DisputeResolved(
        uint256 indexed id,
        bool hackerWon
    );

    // ─── MODIFIERS ───────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyOrg(uint256 _id) {
        require(
            msg.sender == reports[_id].organization,
            "Only organization"
        );
        _;
    }

    modifier onlyHacker(uint256 _id) {
        require(
            msg.sender == reports[_id].hacker,
            "Only hacker"
        );
        _;
    }

    modifier reportExists(uint256 _id) {
        require(
            _id > 0 && _id <= reportCount,
            "Report does not exist"
        );
        _;
    }

    // ─── CONSTRUCTOR ─────────────────────────────────────
    constructor() {
        admin = msg.sender;
    }

    // ─── FUNCTIONS ───────────────────────────────────────

    /**
     * @dev Step 1 — Hacker creates a report on-chain
     * @param _minBounty  AI recommended minimum bounty in wei
     * @param _reportHash IPFS hash of encrypted vulnerability report
     */
    function createReport(
        uint256 _minBounty,
        string memory _reportHash
    ) external returns (uint256) {
        reportCount++;

        reports[reportCount] = BountyReport({
            id:           reportCount,
            hacker:       payable(msg.sender),
            organization: payable(address(0)),
            amount:       0,
            minBounty:    _minBounty,
            status:       Status.Pending,
            reportHash:   _reportHash,
            createdAt:    block.timestamp,
            deadline:     0
        });

        emit ReportCreated(reportCount, msg.sender, _minBounty);
        return reportCount;
    }

    /**
     * @dev Step 2 — Org locks ETH into escrow
     * @param _id      Report ID
     * @param _deadline Unix timestamp deadline for verification
     */
    function lockBounty(
        uint256 _id,
        uint256 _deadline
    ) external payable reportExists(_id) {
        BountyReport storage r = reports[_id];

        require(r.status == Status.Pending,       "Report not pending");
        require(msg.value >= r.minBounty,          "Below AI minimum bounty");
        require(_deadline > block.timestamp,       "Invalid deadline");
        require(r.organization == address(0),      "Already locked");

        r.organization = payable(msg.sender);
        r.amount       = msg.value;
        r.status       = Status.Locked;
        r.deadline     = _deadline;

        emit BountyLocked(_id, msg.sender, msg.value);
    }

    /**
     * @dev Step 3 — Org verifies exploit → releases ETH to hacker
     * @param _id Report ID
     */
    function verifyAndRelease(
        uint256 _id
    ) external reportExists(_id) onlyOrg(_id) {
        BountyReport storage r = reports[_id];
        require(r.status == Status.Locked, "Not locked");

        r.status = Status.Released;

        uint256 fee    = (r.amount * platformFeePercent) / 100;
        uint256 payout = r.amount - fee;

        r.hacker.transfer(payout);
        payable(admin).transfer(fee);

        emit BountyReleased(_id, r.hacker, payout);
    }

    /**
     * @dev Hacker raises dispute if org misses deadline
     * @param _id Report ID
     */
    function raiseDispute(
        uint256 _id
    ) external reportExists(_id) onlyHacker(_id) {
        BountyReport storage r = reports[_id];
        require(r.status == Status.Locked,        "Not locked");
        require(block.timestamp > r.deadline,     "Deadline not passed");

        r.status = Status.Disputed;
        emit DisputeRaised(_id, msg.sender);
    }

    /**
     * @dev Admin resolves dispute
     * @param _id        Report ID
     * @param _payHacker true = pay hacker | false = refund org
     */
    function resolveDispute(
        uint256 _id,
        bool _payHacker
    ) external onlyAdmin reportExists(_id) {
        BountyReport storage r = reports[_id];
        require(r.status == Status.Disputed, "Not disputed");

        if (_payHacker) {
            r.status = Status.Released;
            r.hacker.transfer(r.amount);
            emit DisputeResolved(_id, true);
        } else {
            r.status = Status.Refunded;
            r.organization.transfer(r.amount);
            emit DisputeResolved(_id, false);
        }
    }

    // ─── VIEW FUNCTIONS ──────────────────────────────────

    function getReport(
        uint256 _id
    ) external view reportExists(_id) returns (BountyReport memory) {
        return reports[_id];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}