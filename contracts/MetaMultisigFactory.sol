pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./MetaMultisig.sol";

contract MetaMultisigFactory {

    event MultisigCreated(address indexed multisig);

    function create(address[] memory addresses, uint[] memory weights, uint threshold) public {
        MetaMultisig wallet = new MetaMultisig(addresses, weights, threshold);
        emit MultisigCreated(address(wallet));
    }
}
