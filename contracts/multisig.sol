// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Multisig {
    uint8 public quorum;
    uint8 public noOfValidSigners;
    uint256 public txCount;

    struct Transaction {
        uint256 id;
        uint256 amount;
        address sender;
        address recipient;
        bool isCompleted;
        uint256 timestamp;
        uint256 noOfApproval;
        address tokenAddress;
        address[] transactionSigners;
    }

    struct QuorumChangeRequest {
        uint8 newQuorum;
        uint256 approvals;
    }

    mapping(address => bool) public isValidSigner;
    mapping(uint => Transaction) public transactions; // txId -> Transaction
    mapping(address => mapping(uint256 => bool)) public hasSigned; // signer -> transactionId -> bool
    mapping(address => bool) public hasSignedQuorum;
    mapping(address => bool) public approvers;

    QuorumChangeRequest public pendingQuorumChange;
    bool public quorumChangeRequested;

    constructor(uint8 _quorum, address[] memory _validSigners) {
        noOfValidSigners = uint8(_validSigners.length);
        require(noOfValidSigners > 1, "few valid signers");
        require(_quorum > 1, "quorum is too small");

        for(uint256 i = 0; i < _validSigners.length; i++) {
            require(_validSigners[i] != address(0), "zero address not allowed");
            require(!isValidSigner[_validSigners[i]], "signer already exists");
            isValidSigner[_validSigners[i]] = true;
        }

        if (!isValidSigner[msg.sender]) {
            isValidSigner[msg.sender] = true;
            noOfValidSigners += 1;
        }

        require(_quorum <= noOfValidSigners, "quorum greater than valid signers");
        quorum = _quorum;
    }

    function transfer(uint256 _amount, address _recipient, address _tokenAddress) external {
        require(msg.sender != address(0), "address zero found");
        require(isValidSigner[msg.sender], "invalid signer");
        require(_amount > 0, "can't send zero amount");
        require(_recipient != address(0), "address zero found");
        require(_tokenAddress != address(0), "address zero found");
        require(IERC20(_tokenAddress).balanceOf(address(this)) >= _amount, "insufficient funds");

        uint256 _txId = txCount + 1;
        Transaction storage trx = transactions[_txId];

        txCount += 1;
        trx.id = _txId;
        trx.amount = _amount;
        trx.recipient = _recipient;
        trx.sender = msg.sender;
        trx.timestamp = block.timestamp;
        trx.tokenAddress = _tokenAddress;
        trx.noOfApproval += 1;
        trx.transactionSigners.push(msg.sender);
    }

    function approveTx(uint256 _txId) external {
        Transaction storage trx = transactions[_txId];

        require(trx.id != 0, "invalid tx id");
        require(IERC20(trx.tokenAddress).balanceOf(address(this)) >= trx.amount, "insufficient funds");
        require(!trx.isCompleted, "transaction already completed");
        require(trx.noOfApproval < quorum, "approvals already reached");
        require(isValidSigner[msg.sender], "not a valid signer");
        require(!hasSigned[msg.sender][_txId], "can't sign twice");

        hasSigned[msg.sender][_txId] = true;
        trx.noOfApproval += 1;
        trx.transactionSigners.push(msg.sender);

        if(trx.noOfApproval == quorum) {
            trx.isCompleted = true;
            IERC20(trx.tokenAddress).transfer(trx.recipient, trx.amount);
        }
    }

    function updateQuorum(uint8 _newQuorum) external {
        require(msg.sender != address(0), "address zero found");
        require(isValidSigner[msg.sender], "invalid signer");
        require(_newQuorum <= noOfValidSigners, "quorum greater than valid signers");
        require(!quorumChangeRequested, "quorum change already requested");

        // Create a pending quorum change request
        quorumChangeRequested = true;
        pendingQuorumChange.newQuorum = _newQuorum;
        pendingQuorumChange.approvals = 1; // The requester has already approved it
        approvers[msg.sender] = true;
    }

    function approveNewQuorum() external {
        require(quorumChangeRequested, "No quorum change requested");
        require(msg.sender != address(0), "address zero found");
        require(isValidSigner[msg.sender], "invalid signer");
        require(!approvers[msg.sender], "Can't approve twice");
        require(getPendingTx().length == 0, "Some transactions ongoing");

        pendingQuorumChange.approvals += 1;
        approvers[msg.sender] = true;

        // Once enough approvals are reached, finalize the quorum change
        if (pendingQuorumChange.approvals >= quorum) {
            quorum = pendingQuorumChange.newQuorum;
            quorumChangeRequested = false;
        }
        resetQuorumApprovals();
    }

    function resetQuorumApprovals() internal {
        for (uint256 i = 0; i < noOfValidSigners; i++) {
            hasSignedQuorum[msg.sender] = false;
        }
        pendingQuorumChange.approvals = 0;
    }

    function getPendingTx() public view returns (Transaction[] memory) {
        uint256 pendingCount = 0;

        // First, determine how many pending transactions there are.
        for (uint256 i = 1; i <= txCount; i++) {
            if (!transactions[i].isCompleted) {
                pendingCount++;
            }
        }

        // Create a memory array to hold the pending transactions.
        Transaction[] memory pendingTransactions = new Transaction[](pendingCount);
        uint256 index = 0;

        // Populate the array with the pending transactions.
        for (uint256 i = 1; i <= txCount; i++) {
            if (!transactions[i].isCompleted) {
                pendingTransactions[index] = transactions[i];
                index++;
            }
        }

        return pendingTransactions;
    }
}