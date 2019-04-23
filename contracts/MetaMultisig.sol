// ALMOST TOTALLY UNTESTED

pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract MetaMultisig {
    using SafeMath for uint;
    using ECDSA for bytes32;

    mapping(address=>uint) public keyholders;
    uint totalWeight;
    uint public threshold;
    uint public nextNonce;

    event KeyholderChanged(address indexed keyholder, uint weight);
    event ThresholdChanged(uint threshold);
    event Transaction(address indexed destination, uint value, bytes data, uint nonce, bytes returndata, address[] signatories);
    event Deposit(address indexed sender, uint value);

    constructor(address[] memory addresses, uint[] memory weights, uint _threshold) public {
        require(addresses.length == weights.length);

        threshold = _threshold;
        emit ThresholdChanged(_threshold);

        uint _totalWeight = 0;

        for(uint i = 0; i < addresses.length; i++) {
            emit KeyholderChanged(addresses[i], weights[i]);
            keyholders[addresses[i]] = weights[i];
            _totalWeight = _totalWeight.add(weights[i]);
        }
        totalWeight = _totalWeight;
        require(threshold > 0, "Threshold must be greater than zero.");
        require(threshold <= totalWeight, "Threshold must not be larger than the sum of all weights.");
    }

    function() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    modifier selfOnly {
        require(msg.sender == address(this));
        _;
    }

    function setKeyholderWeight(address keyholder, uint weight) external selfOnly {
        totalWeight = totalWeight.sub(keyholders[keyholder]).add(weight);
        keyholders[keyholder] = weight;
        require(threshold <= totalWeight, "Weight change would make approvals impossible.");

        emit KeyholderChanged(keyholder, weight);
    }

    function setThreshold(uint _threshold) external selfOnly {
        threshold = _threshold;
        require(threshold > 0, "Threshold must be greater than zero.");
        require(threshold <= totalWeight, "Threshold change would make approvals impossible.");
    }

    function getTransactionHash(address destination, uint value, bytes memory data, uint nonce) public view returns(bytes32) {
        return keccak256(abi.encodePacked(
            address(this),
            destination,
            value,
            keccak256(data),
            nonce
        ));
    }

    function submit(address payable destination, uint value, bytes memory data, uint nonce, bytes[] memory sigs) public {
        require(nonce == nextNonce, "Nonces must be sequential.");
        nextNonce++;

        address[] memory signatories = new address[](sigs.length);
        bytes32 txhash = getTransactionHash(destination, value, data, nonce).toEthSignedMessageHash();
        uint weight = 0;
        for(uint i = 0; i < sigs.length; i++) {
            address signer = txhash.recover(sigs[i]);
            signatories[i] = signer;
            require(i == 0 || signer > signatories[i - 1], "Signatures must be in address order.");
            weight += keyholders[signer];
        }
        require(weight >= threshold);

        (bool result, bytes memory ret) = destination.call.value(value)(data);
        require(result, "Transaction failed.");
        emit Transaction(destination, value, data, nonce, ret, signatories);
    }
}
