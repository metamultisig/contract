let MetaMultisig = artifacts.require("MetaMultisig");
let MetaMultisigFactory = artifacts.require("MetaMultisigFactory");

let TestToken = artifacts.require("TestToken");

contract('MetaMultisigFactory', function (accounts) {
    let factory = null;
    let nonKeyHolder = null;
    let keyHolder1 = null;
    let keyHolder2 = null;
    let keyHolder3 = null;
    let threshold = 2;

    beforeEach(async function () {
        nonKeyHolder = accounts[0];
        keyHolder1 = accounts[1];
        keyHolder2 = accounts[2];
        keyHolder3 = accounts[3];

        factory = await MetaMultisigFactory.new();
    });

    it('can create a new multisig and the initial state is correct', async function () {

        await factory.create([keyHolder1, keyHolder2, keyHolder3], [1, 1, 2], threshold);
        let events = await factory.getPastEvents( 'MultisigCreated', { fromBlock: 0, toBlock: 'latest' } );
        let multisig = await MetaMultisig.at(events[0].returnValues.multisig);

        assert.equal(await multisig.keyholders(keyHolder1), 1);
        assert.equal(await multisig.keyholders(keyHolder2), 1);
        assert.equal(await multisig.keyholders(keyHolder3), 2);
        assert.equal(await multisig.keyholders(nonKeyHolder), 0);
        assert.equal(await multisig.threshold(), threshold);
        assert.equal(await multisig.nextNonce(), 0);
    });

});
