let MetaMultisig = artifacts.require("MetaMultisig");
let TestToken = artifacts.require("TestToken");

contract('MetaMultisig', function (accounts) {
    let multisig = null;
    let token = null;
    let nonKeyHolder = null;
    let keyHolder1 = null;
    let keyHolder2 = null;
    let keyHolder3 = null;
    let threshold = 2;

    let someTokens = web3.utils.toWei('10', 'ether');
    let evenMoreTokens = web3.utils.toWei('20', 'ether');

    async function sign(hash, account) {
        let sig = await web3.eth.sign(hash, account);
        let v = parseInt(sig.slice(128), 16) + 27;
        return sig.slice(0, 128) + v.toString(16);
    }

    async function sortedMultiSign(hash, accounts) {
        let sorted = accounts.sort(sortAscIgnoreCase);
        let signatures = [];
        for (let i = 0; i < sorted.length; i++) {
            signatures.push(await sign(hash, sorted[i]));
        }
        return signatures;
    }

    async function unsortedMultiSign(hash, accounts) {
        let unsorted = accounts.sort(sortAscIgnoreCase).reverse();
        let signatures = [];
        for (let i = 0; i < unsorted.length; i++) {
            signatures.push(await sign(hash, unsorted[i]));
        }
        return signatures;
    }

    beforeEach(async function () {
        nonKeyHolder = accounts[0];
        keyHolder1 = accounts[1];
        keyHolder2 = accounts[2];
        keyHolder3 = accounts[3];

        // A new multisig requiring either keyHolder1 and keyHolder2 or just keyHolder3.
        multisig = await MetaMultisig.new([keyHolder1, keyHolder2, keyHolder3], [1, 1, 2], threshold);

        // Deposit 1 eth
        await web3.eth.sendTransaction({from: keyHolder1, to: multisig.address, value: web3.utils.toWei('1', 'ether')});

        // Mint some ERC20 tokens to the multisig
        token = await TestToken.new();
        await token.mint(multisig.address, someTokens);

    });

    it('initial state is correct', async function () {
        assert.equal(await multisig.keyholders(keyHolder1), 1);
        assert.equal(await multisig.keyholders(keyHolder2), 1);
        assert.equal(await multisig.keyholders(keyHolder3), 2);
        assert.equal(await multisig.keyholders(nonKeyHolder), 0);
        assert.equal(await multisig.threshold(), threshold);
        assert.equal(await multisig.nextNonce(), 0);

        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('1', 'ether'), "ether balance matches");

        assert.equal(await token.balanceOf(multisig.address), someTokens, "token balance matches");
    });

    it('fails when invalid constructor arguments used', async function () {
        try {
            // More keyholders than weights
            multisig = await MetaMultisig.new([keyHolder1, keyHolder2, keyHolder3], [1, 1], 2);
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }

        try {
            // Less keyholders than weights
            multisig = await MetaMultisig.new([keyHolder1, keyHolder2], [1, 1, 2], 2);
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }

        try {
            // Total threshold less than required
            multisig = await MetaMultisig.new([keyHolder1, keyHolder2, keyHolder3], [1, 1, 1], 4);
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }

        try {
            // Threshold is zero
            multisig = await MetaMultisig.new([keyHolder1, keyHolder2, keyHolder3], [1, 1, 2], 0);
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
    });

    it('sends simple eth transaction signed by multiple addresses', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = await sortedMultiSign(sighash, [keyHolder1, keyHolder2]);

        await multisig.submit(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('0.9', 'ether'));
    });

    it('fails to send simple eth transaction, multiple signatures not in address order', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = await unsortedMultiSign(sighash, [keyHolder1, keyHolder2]);
        try {
            await multisig.submit(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('1', 'ether'));
    });

    it('sends simple eth transaction signed by one address with enough threshold', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('0.9', 'ether'));
    });

    it('fails to send eth transaction when not enough eth balance', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder3, web3.utils.toWei('2.0', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        try {
            await multisig.submit(keyHolder3, web3.utils.toWei('2.0', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('1.0', 'ether'));
    });

    it('rejects already executed transaction, invalid nonce', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});

        try {
            await multisig.submit(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
    });

    it('rejects transaction with future nonce', async function () {
        const nonce = (await multisig.nextNonce())+1;
        const sighash = await multisig.getTransactionHash(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        try {
            await multisig.submit(keyHolder3, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
    });

    it('rejects transactions with invalid signatures', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = await sortedMultiSign(sighash, [keyHolder1, keyHolder2]);
        // Try and send to a different account than the one the signature is for.
        try {
            await multisig.submit(keyHolder2, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
    });

    it('rejects transactions when threshold not met', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder1)];
        // KeyHolder1 does not have enough weight
        try {
            await multisig.submit(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
    });

    it('sends tokens from multisig', async function () {
        const nonce = await multisig.nextNonce();

        const data = await web3.eth.abi.encodeFunctionCall({
            name: 'transfer',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            }, {
                type: 'uint256',
                name: 'value'
            }]
        }, [keyHolder3, someTokens]);

        const sighash = await multisig.getTransactionHash(token.address, 0, data, nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(token.address, 0, data, nonce, sigs, {from: nonKeyHolder});

        assert.equal(await token.balanceOf(multisig.address), 0, "multisig should have no tokens");
        assert.equal(await token.balanceOf(keyHolder3), someTokens, "keyholder should have all the tokens");
    });

    it('fails when trying to send more tokens than available', async function () {
        const nonce = await multisig.nextNonce();

        const data = await web3.eth.abi.encodeFunctionCall({
            name: 'transfer',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            }, {
                type: 'uint256',
                name: 'value'
            }]
        }, [keyHolder3, evenMoreTokens]);

        const sighash = await multisig.getTransactionHash(token.address, 0, data, nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        try {
            await multisig.submit(token.address, 0, data, nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await token.balanceOf(multisig.address), someTokens, "multisig should have all tokens");
        assert.equal(await token.balanceOf(keyHolder3), 0, "keyholder should have no tokens");
    });

    it('correctly updates the threshold', async function () {
        const nonce = await multisig.nextNonce();

        const newThreshold = 3;

        const data = await web3.eth.abi.encodeFunctionCall({
            name: 'setThreshold',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: 'threshold'
            }]
        }, [newThreshold]);

        const sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        const sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});

        assert.equal(await multisig.threshold(), newThreshold);
    });

    it('fails to update the threshold if invalid input', async function () {
        const nonce = await multisig.nextNonce();

        let newThreshold = 0;
        let data = await web3.eth.abi.encodeFunctionCall({
            name: 'setThreshold',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: 'threshold'
            }]
        }, [newThreshold]);

        let sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        let sigs = [await sign(sighash, keyHolder3)];

        try {
            // Threshold cannot be 0
            await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await multisig.threshold(), threshold);


        newThreshold = 100;
        data = await web3.eth.abi.encodeFunctionCall({
            name: 'setThreshold',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: 'threshold'
            }]
        }, [newThreshold]);

        sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        sigs = [await sign(sighash, keyHolder3)];

        try {
            // Threshold cannot be greater than total weights of keyholders
            await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await multisig.threshold(), threshold);
    });

    it('fails to update the threshold if called directly', async function () {
        const newThreshold = 3;
        try {
            await multisig.setThreshold(newThreshold, {from: keyHolder3});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await multisig.threshold(), threshold);
    });

    it('fails to update the weights if called directly', async function () {
        try {
            await multisig.setKeyholderWeight(keyHolder3, 10, {from: keyHolder3});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await multisig.keyholders(keyHolder3), 2);
    });

    it('correctly updates the weights', async function () {
        let nonce = await multisig.nextNonce();

        // Add a new keyholder
        const newKeyholder = accounts[4];
        const newWeight = 1;

        let data = await web3.eth.abi.encodeFunctionCall({
            name: 'setKeyholderWeight',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            }, {
                type: 'uint256',
                name: 'threshold'
            }]
        }, [newKeyholder, newWeight]);

        let sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        let sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});

        assert.equal(await multisig.keyholders(newKeyholder), newWeight);

        // Remove existing keyholder
        data = await web3.eth.abi.encodeFunctionCall({
            name: 'setKeyholderWeight',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            }, {
                type: 'uint256',
                name: 'threshold'
            }]
        }, [keyHolder1, 0]);

        nonce = await multisig.nextNonce();
        sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        sigs = [await sign(sighash, keyHolder3)];
        await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});

        assert.equal(await multisig.keyholders(keyHolder1), 0);
    });

    it('fails to update the weights when set below the threshold', async function () {

        multisig = await MetaMultisig.new([keyHolder1, keyHolder2], [1, 1], 2);
        const nonce = await multisig.nextNonce();

        const data = await web3.eth.abi.encodeFunctionCall({
            name: 'setKeyholderWeight',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            }, {
                type: 'uint256',
                name: 'threshold'
            }]
        }, [keyHolder1, 0]);

        const sighash = await multisig.getTransactionHash(multisig.address, 0, data, nonce);
        const sigs = await sortedMultiSign(sighash, [keyHolder1, keyHolder2]);

        try {
            await multisig.submit(multisig.address, 0, data, nonce, sigs, {from: nonKeyHolder});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }

        assert.equal(await multisig.keyholders(keyHolder1), 1);
    });

    it('submitting transaction directly by a keyholder counts as signing it', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = [await sign(sighash, keyHolder1)];

        await multisig.submit(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: keyHolder2});
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('0.9', 'ether'));
    });

    it('fails when both signed and submitted by the same keyholder', async function () {
        const nonce = await multisig.nextNonce();
        const sighash = await multisig.getTransactionHash(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce);
        const sigs = await sortedMultiSign(sighash, [keyHolder1, keyHolder2]);

        try {
            await multisig.submit(keyHolder1, web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: keyHolder2});
            assert.fail("Expected exception");
        } catch (e) {
            assert.ok(e.message.includes('revert'));
        }
        assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('1.0', 'ether'));
    });

    function sortAscIgnoreCase(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();
        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        } else if (a === b) {
            return 0;
        }
    }
});
