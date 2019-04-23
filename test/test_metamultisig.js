var MetaMultisig = artifacts.require("MetaMultisig");

contract('MetaMultisig', function(accounts) {
  let multisig = null;

  async function sign(hash, account) {
    let sig = await web3.eth.sign(hash, account);
    let v = parseInt(sig.slice(128), 16) + 27;
    return sig.slice(0, 128) + v.toString(16);
  }

  before(async function() {
    // A new multisig requiring either accounts[0] and accounts[1] or just accounts[2].
    multisig = await MetaMultisig.new([accounts[0], accounts[1], accounts[2]], [1, 1, 2], 2);
  });

  it('initializes keyholders and threshold correctly', async function() {
    assert.equal(await multisig.keyholders(accounts[0]), 1);
    assert.equal(await multisig.keyholders(accounts[1]), 1);
    assert.equal(await multisig.keyholders(accounts[2]), 2);
    assert.equal(await multisig.keyholders(accounts[3]), 0);
    assert.equal(await multisig.threshold(), 2);
    assert.equal(await multisig.nextNonce(), 0);
  });

  it('accepts ether', async function() {
    const tx = await web3.eth.sendTransaction({from: accounts[0], to: multisig.address, value: web3.utils.toWei('1', 'ether')});
    assert.equal(tx.logs.length, 1);
    assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('1', 'ether'));
  });

  it('sends simple transactions', async function() {
    const nonce = await multisig.nextNonce();
    const sighash = await multisig.getTransactionHash(accounts[0], web3.utils.toWei('0.1', 'ether'), '0x', nonce);
    const sigs = [await sign(sighash, accounts[0]), await sign(sighash, accounts[1])];
    const tx = await multisig.submit(accounts[0], web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: accounts[3]});
    console.log(tx.hash);
    assert.equal(await web3.eth.getBalance(multisig.address), web3.utils.toWei('0.9', 'ether'));
  });

  it('rejects transactions with invalid signatures', async function() {
    const nonce = await multisig.nextNonce();
    const sighash = await multisig.getTransactionHash(accounts[0], web3.utils.toWei('0.1', 'ether'), '0x', nonce);
    const sigs = [await sign(sighash, accounts[0]), await sign(sighash, accounts[1])];
    // Try and send to a different account than the one the signature is for.
    try {
      await multisig.submit(accounts[1], web3.utils.toWei('0.1', 'ether'), '0x', nonce, sigs, {from: accounts[3]});
      assert.fail("Expected exception");
    } catch(e) {
      assert.ok(e.message.includes('revert'));
    }
  });
});
