# MetaMultisig


## Unit tests

To run unit tests with Truffle:

```
truffle develop
> test
```

should end up with something like the below:

```
  Contract: MetaMultisig
    ✓ initial state is correct (195ms)
    ✓ fails when invalid constructor arguments used (582ms)
    ✓ sends simple eth transaction signed by multiple addresses (218ms)
    ✓ fails to send simple eth transaction, multiple signatures not in address order (268ms)
    ✓ sends simple eth transaction signed by one address with enough threshold (246ms)
    ✓ fails to send eth transaction when not enough eth balance (233ms)
    ✓ rejects already executed transaction, invalid nonce (203ms)
    ✓ rejects transactions with invalid signatures (243ms)
    ✓ rejects transactions when threshold not met (224ms)
    ✓ sends tokens from multisig (184ms)
    ✓ fails when trying to send more tokens than available (238ms)
    ✓ correctly updates the threshold (190ms)
    ✓ fails to update the threshold if invalid input (829ms)
    ✓ fails to update the threshold if called directly (107ms)
    ✓ correctly updates the weights (450ms)
    ✓ fails to update the weights when set below the threshold (400ms)
    ✓ submitting transaction directly by a keyholder counts as signing it (150ms)
    ✓ fails when both signed and submitted by the same keyholder (184ms)

 18 passing
```

To generate coverage report with [solidity-coverage](https://github.com/sc-forks/solidity-coverage): 

```
./node_modules/.bin/solidity-coverage
```

what should end up with something like this:

| File                |   % Stmts  |  % Branch  |   % Funcs  |   % Lines  | Uncovered Lines  |
| ------------------- | ---------: | ---------: | ---------: | ---------: | ---------------: |
| contracts/          |       100  |       100  |       100  |       100  |                  |
|  MetaMultisig.sol   |       100  |       100  |       100  |       100  |                  |
| All files           |       100  |       100  |       100  |       100  |                  |

