import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json'
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json'
import Config from './config.json'
import Web3 from 'web3'

export default class Contract {
  constructor (network, callback) {
    let config = Config[network]
    // Inject web3
    if (window.ethereum) {
      // use metamask's providers
      // modern browsers
      this.web3 = new Web3(window.ethereum)
      // Request accounts access
      try {
        window.ethereum.enable()
      } catch (error) {
        console.error('User denied access to accounts')
      }
    } else if (window.web3) {
      // legacy browsers
      this.web3 = new Web3(web3.currentProvider)
    } else {
      // fallback for non dapp browsers
      this.web3 = new Web3(new Web3.providers.HttpProvider(config.url))
    }

    // Load contract
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress)
    this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.appAddress)
    this.initialize(callback)
    this.account = null
  }

  initialize (callback) {
    this.web3.eth.getAccounts((error, accts) => {
      if (!error) {
        this.account = accts[0]
        callback()
      } else {
        console.error(error)
      }
    })
  }

  isOperational (callback) {
    let self = this
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.account }, callback)
  }

  async fetchFlightStatus (flightId) {
    try {
      let flightDetail = await this.flightSuretyApp.methods.getFlightDetail(flightId).call();
      await this.flightSuretyApp.methods
        .fetchFlightStatus(flightDetail.flight, flightDetail.departureTimestamp, flight.airline)
        .send({ from: this.account })
    } catch (error) {
      return {
        error: error
      }
    }
  }

  async registerAirline (airline) {
    try {
      await this.flightSuretyApp.methods
        .registerAirline(airline)
        .send({ from: this.account })
      return {
        address: this.account
      }
    } catch (error) {
      return {
        error: error
      }
    }
  }

  async registerFlight (flightName,departureTimestamp) {
    try {
      await this.flightSuretyApp.methods
        .registerFlight(flightName,departureTimestamp)
        .send({ from: this.account })
      return {
        address: this.account,
        error: ''
      }
    } catch (error) {
      return {
        address: this.account,
        error: error
      }
    }
  }
  async registerInsurance (flightId,price) {
    const amount = this.web3.utils.toWei(price.toString(), 'ether')
    try {
      await this.flightSuretyApp.methods
        .buyInsurance(flightId)
        .send({
          from: this.account,
          value: this.web3.utils.toWei(amount.toString(), 'ether')
        })
      return { passenger: this.account }
    } catch (error) {
      console.log(error)
      return {
        error: error
      }
    }
  }

  async withdraw () {
    await this.flightSuretyApp.methods
      .withdraw()
      .send({ from: this.account })
  }
}
