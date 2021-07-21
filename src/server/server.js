import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json'
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json'
import Config from './config.json'
import Web3 from 'web3'
import express from 'express'
require('babel-polyfill')
const bodyParser = require('body-parser')

let config = Config['localhost']
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')))
web3.eth.defaultAccount = web3.eth.accounts[0]
const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress)
const flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress)
const NUMBER_OF_ACCOUNTS = 10 
const NUMBER_OF_ORACLES = 3

const Server = {
  oracles: [],
  flightList: [],
  states: {
    0: 'unknown',
    10: 'on time',
    20: 'late due to airline',
    30: 'late due to weather',
    40: 'late due to technical reason',
    50: 'late due to other reason'
  },

  init: async function (numberOracles) {
    // EVENTS LISTENERS
    flightSuretyApp.events.OracleRegistered()
      .on('data', log => {
        const { event, returnValues: { indexes } } = log
        console.log(`${event}: indexes ${indexes[0]} ${indexes[1]} ${indexes[2]}`)
      })
      .on('error', error => { console.log(error) })

    flightSuretyData.events.AirlineRegistered()
      .on('data', log => {
        const {
          event, returnValues: { airlineAddress } } = log
        console.log(`${event}:  ${airlineAddress}`)
      })
      .on('error', error => { console.log(error) })

      flightSuretyData.events.FlightRegistered()
      .on('data', async log => {
        const {
          event,
          returnValues: { flight, timestamp}
        } = log
        console.log(`${event}: ${flight} departureTimestamp ${timestamp}`)

        // store new flight
        const totalFlight = await flightSuretyData.methods.totalFlight().call()
        const flightDetail = await flightSuretyData.methods.getFlightDetail(totalFlight).call();
        this.flightList.push({
          id: totalFlight,
          key: flightDetail.key,
          flightName: flightDetail.flight,
          airtline: flightDetail.airtline,
          departureTime: flightDetail.departureTimestamp,          
          status : flightDetail.departureStatusCode
        });
      })
      .on('error', error => { console.log(error) })

    flightSuretyApp.events.OracleRequest()
      .on('error', error => { console.log(error) })
      .on('data', async log => {
        const {
          event,
          returnValues: { index, airline,flight, timestamp }
        } = log

        console.log(`${event}: index ${index},airline ${airline}, flight ${flight}, landing ${timestamp}`)
      
        await this.submitResponses(airline,flight, timestamp)
      })

    flightSuretyApp.events.OracleReport()
      .on('data', log => {
        const {
          event,
          returnValues: { index, airline,flight, timestamp }
        } = log
        console.log(`${event}: index ${index},airline ${airline}, flight ${flight}, landing ${timestamp}`)
      })

    flightSuretyApp.events.FlightStatusInfo()
      .on('data', log => {
        const {
          event,
          returnValues: { airline, flight, timestamp, statusCode }
        } = log
        console.log(`${event}: airline:${airline}, flight: ${flight}, timestamp: ${timestamp}, status: ${this.states[statusCode]}`)
      })
      .on('error', error => { console.log(error) })

    flightSuretyApp.events.FlightProcessed()
      .on('data', log => {
        const { event, returnValues: {  airline,  flight,  timestamp,  statusCode } } = log
        console.log(`${event}: airline ${airline}, flight ${flight}, timestamp ${timestamp}, status ${this.states[statusCode]}`)
      })
    // Add oracles addresses
    this.oracles = (await web3.eth.getAccounts()).slice(NUMBER_OF_ACCOUNTS - numberOracles)
    // register oracles
    const registrationFee = await flightSuretyApp.methods.registrationFee().call()
    this.oracles.forEach(async account => {
      try {
        await flightSuretyApp.methods.registerOracle().send({
          from: account,
          value: registrationFee,
          gas: 4712388,
          gasPrice: 100000000000
        })
      } catch (error) {
        // console.log(error.message)
      }
    })
    this.updateFlightList()
  },

  submitResponses: async function (airtline,flight, timestamp) {
    // random number out of [10, 20, 30, 40, 50]
    const statusCode = (Math.floor(Math.random() * 5) + 1) * 10
    this.oracles.forEach(async oracle => {
  
      // get indexes
      const oracleIndexes = await flightSuretyApp.methods.getMyIndexes().call({ from: oracle })
      oracleIndexes.forEach(async index => {
        try {
          await flightSuretyApp.methods.submitOracleResponse(
            index,
            airtline,
            flight,
            timestamp,
            statusCode
          ).send({ from: oracle })
        } catch (error) {
          // console.log(error.message)
        }
      })
    })
  },

  updateFlightList: async function () {
    // Clean array
    
    console.log('updateFlightList');
    this.flightList = []
    try {
      const totalFlight = await flightSuretyData.methods.totalFlight().call()
      for (let i = 1; i <= totalFlight; i++) {
        const flightDetail = await flightSuretyData.methods.getFlightDetail(i).call();   
        // as unique key, an index is added and will be displayed in the front end form (instead of displaying the hash key)
        this.flightList.push({
          id: totalFlight,
          key: flightDetail.key,
          flightName: flightDetail.flight,
          airtline: flightDetail.airtline,
          departureTime: flightDetail.departureTimestamp,
          status : flightDetail.departureStatusCode
        });
      }
    } catch (error) {
      // console.log('No flights to add')
    }
  }
}

Server.init(NUMBER_OF_ORACLES)

const app = express()
app.use(bodyParser.json())
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.use(express.json())
// app.use(bodyParser.urlencoded({ extended: true }))
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})
app.set('json spaces', 2)
app.get('/flightList', (req, res) => {
  res.json(Server.flightList)
})
app.get('/flight/:airline.:flight.:timestamp', async (req, res) => {
  const key = await flightSuretyData.methods.getFlightKey(
    req.params.airline,
    req.params.flight,
    req.params.timestamp
  ).call();
  const id = await flightSuretyData.methods.getFlightIdByKey(key).call();
  const flight = await flightSuretyData.methods.getFlightDetail(id).call();
  res.send(flight)
})
app.get('/response/:airline.:flight.:timestamp', async (req, res) => {
  const key = await flightSuretyData.methods.getFlightKey(
    req.params.airline,
    req.params.flight,
    req.params.timestamp
  ).call();
  const response = await flightSuretyApp.methods.oracleResponses(key).call();
  res.send(response)
})

export default app
