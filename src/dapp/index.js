
import DOM from './dom'
import Contract from './contract'
import './flightsurety.css'


(async () => {
  let result = null

  let contract = new Contract('localhost', () => {
    contract.isOperational((error, result) => {
      display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }])
    })

    function fetchAndAppendFlights () {
      fetch('http://localhost:3000/flightList')
        .then(res => {
          return res.json()
        })
        .then(flights => {
          
        let flightsString = "";
          flights.forEach(flight => {
            if (flight.flight.statusCode == 0) {
              let {
                index,
                flight: { id,flightName, timestamp }
              } = flight
              flightsString +=` <div class="row"><a> flightId : ${id} - ${flightName} - ${timestamp}</a></div>`;
            }
          })
          
        DOM.elid('flightList').innerHTML = flightsString;
        })
    }   
    fetchAndAppendFlights()   
    DOM.elid('submitOracle').addEventListener('click', async () => {
      // destructure
      let flightId = DOM.elid('oracleRequestFlighttId').value;
      await contract.fetchFlightStatus(flightId);
    })

    DOM.elid('registerAirlineButton').addEventListener('click', async () => {
      const newAirline = DOM.elid('registerAirlineAddress').value
      await contract.registerAirline(newAirline)
      const { address, error } = await contract.registerAirline(newAirline)
      display(
        `Airline :  ${address}`
      )
    })

    DOM.elid('registerFlightButton').addEventListener('click', async () => {
      const departureTimestamp = new Date(DOM.elid('registerFlightDepartureTime').value).getTime()
      const flightName = DOM.elid('registerFlightName').value
      await contract.registerFlight(flightName,departureTimestamp);
    })

    DOM.elid('fund').addEventListener('click', () => {
      let amount = DOM.elid('fundAmount').value
      contract.fund(amount, (error, result) => {
        display(`Airline ${sliceAddress(result.address)}`, 'Provide Funding', [{
          label: 'Funding',
          error: error,
          value: `${result.amount} ETH` }])
      })
    })

    DOM.elid('registerInsuranceButton').addEventListener('click', async () => {
      let flightId = DOM.elid('registerInsuranceFlightId').value;
      let amount = DOM.elid('registerInsuranceAmount').value;
      await contract.registerInsurance(flightId,amount);      
    })

    // Withdraw funds
    DOM.elid('withdraw').addEventListener('click', () => {
      try {
        contract.withdraw()
      } catch (error) {
        console.log(error.message)
      }
    })
  })
})()

function display (title, description, results) {
  let displayDiv = DOM.elid('display-wrapper')
  let section = DOM.section()
  section.appendChild(DOM.h5(title))
  section.appendChild(DOM.span(description))
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: 'row' }))
    row.appendChild(DOM.span({ className: 'col-sm-4 field' }, result.label))
    row.appendChild(DOM.span({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)))
    section.appendChild(row)
  })
  displayDiv.append(section)
}

function sliceAddress (address) {
  return `${address.slice(0, 5)}...${address.slice(-3)}`
}

function parseDate(dateNum) {
  return new Date(dateNum).toString().slice(0, -42)
}
