"enable aexpr";

import Morph from 'src/components/widgets/lively-morph.js';
import Wallet from 'src/blockchain/wallet/wallet.js';
import Transaction from 'src/blockchain/transaction/transaction.js';
import TransactionInputCollection from 'src/blockchain/transaction/transactionInputCollection.js';
import TransactionOutputCollection from 'src/blockchain/transaction/transactionOutputCollection.js';

export default class BlockchainTransaction extends Morph {
  
  
  async initialize() {
    this.windowTitle = "BlockchainTransactionView";
    this._transaction = null;
  }
  
  set transaction(transaction) {
    this._transaction = transaction;
    this.update();
  }
  
  get transaction() {
    return this._transaction
  }

  async update() {
    if(!this._transaction) {
      return
    }
    console.log(this._transaction.senderPublicKey)
    this.shadowRoot.querySelector('#hash').innerHTML = this._transaction.hash.digest().toHex();
    this.shadowRoot.querySelector('#sender span').innerHTML = this._transaction.senderHash.digest().toHex();
    this.shadowRoot.querySelector('#timestamp span').innerHTML = new Date(this._transaction.timestamp).toISOString();
    this.shadowRoot.querySelector('#inputValue span').innerHTML = this._transaction.inputValue();
    this.shadowRoot.querySelector('#outputValue span').innerHTML = this._transaction.outputValue();
    this.shadowRoot.querySelector('#fees span').innerHTML = this._transaction.fees();
    if(this._transaction.isSigned()) {
      this.shadowRoot.querySelector('#publicKey span').innerHTML = "signed";
    } else {
      this.shadowRoot.querySelector('#publicKey span').innerHTML = "not signed";
    }
  }
  
  _createNewTransaction() {
    const sender = new Wallet();
    const inputCollection = new TransactionInputCollection(sender);
    const outputCollection = new TransactionOutputCollection();
    this.transaction = new Transaction(sender, inputCollection, outputCollection);
  }
  
  async livelyExample() {
    this._createNewTransaction();
  }
  
  
}