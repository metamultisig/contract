# MetaMultisig


## Unit tests

To run unit tests with Truffle:

```
truffle develop
truffle(develop)> test
```

should end up with something like the below:

```
  Contract: MetaMultisig
    ✓ initial state is correct (130ms)
    ✓ fails when invalid constructor arguments used (314ms)
    ✓ sends simple eth transaction signed by multiple addresses (122ms)
    ✓ fails to send simple eth transaction, multiple signatures not in address order (126ms)
    ✓ sends simple eth transaction signed by one address with enough threshold (95ms)
    ✓ fails to send eth transaction when not enough eth balance (105ms)
    ✓ rejects already executed transaction, invalid nonce (139ms)
    ✓ rejects transactions with invalid signatures (112ms)
    ✓ rejects transactions when threshold not met (97ms)
    ✓ sends tokens from multisig (130ms)
    ✓ fails when trying to send more tokens than available (135ms)
    ✓ correctly updates the threshold (110ms)
    ✓ fails to update the threshold if invalid input (265ms)
    ✓ fails to update the threshold if called directly (51ms)
    ✓ fails to update the weights if called directly (56ms)
    ✓ correctly updates the weights (222ms)
    ✓ fails to update the weights when set below the threshold (243ms)
    ✓ submitting transaction directly by a keyholder counts as signing it (114ms)
    ✓ fails when both signed and submitted by the same keyholder (112ms)

  19 passing (6s)
```

To generate coverage report with [solidity-coverage](https://github.com/sc-forks/solidity-coverage): 

```
./node_modules/.bin/solidity-coverage
```

what should end up with something like this:

|-------------------|----------|----------|----------|----------|----------------|
|File               |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
|-------------------|----------|----------|----------|----------|----------------|
| contracts/        |      100 |      100 |      100 |      100 |                |
|  MetaMultisig.sol |      100 |      100 |      100 |      100 |                |
|-------------------|----------|----------|----------|----------|----------------|
|All files          |      100 |      100 |      100 |      100 |                |
|-------------------|----------|----------|----------|----------|----------------|

