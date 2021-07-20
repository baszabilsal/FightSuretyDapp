
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(config.secondAirline, {from: config.owner});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isAirline.call(config.secondAirline); 

    // ASSERT
    assert.equal(result, true, "Airline should not be able to register another airline if it hasn't provided funding");

  });
  
  
  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    await config.flightSuretyApp.registerAirline(config.thirdAirline, {from: config.owner});  
    await config.flightSuretyApp.registerAirline(config.fouthAirline, {from: config.owner});

    await config.flightSuretyData.setAirlineIsVoter(config.secondAirline, {from: config.owner});         
    await config.flightSuretyData.setAirlineIsVoter(config.thirdAirline, {from: config.owner});
    await config.flightSuretyData.setAirlineIsVoter(config.fouthAirline, {from: config.owner}); 
    
    await config.flightSuretyApp.registerAirline(config.fifthAirline, {from: config.owner});  
    let result = await config.flightSuretyData.isAirline.call(config.fifthAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });
  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
     
    await config.flightSuretyApp.registerAirline(config.fifthAirline, {from: config.secondAirline});
    let result = await config.flightSuretyData.isAirline.call(config.fifthAirline); 

    // ASSERT
    assert.equal(result, true,"bas");

  });
  it('registerFlight', async () => {    
    await config.flightSuretyApp.registerFlight(config.flightOne.flight,config.flightOne.departureTime, {from: config.owner});  
    let flightKey = await config.flightSuretyData.getFlightKey.call(config.owner,config.flightOne.flight,config.flightOne.departureTime); 
    let flightId = await config.flightSuretyData.getFlightIdByKey.call(flightKey);
    let flightDetail = await  config.flightSuretyData.getFlightDetail.call(flightId);
    // ASSERT
    assert.equal(flightDetail.id > 0, true, "Airline should not be able to register another airline if it hasn't provided funding");

  });
  it('registerInsurance', async () => {     
    let flightKey = await config.flightSuretyData.getFlightKey.call(config.owner,config.flightOne.flight,config.flightOne.departureTime); 
    let flightId = await config.flightSuretyData.getFlightIdByKey.call(flightKey);
    await config.flightSuretyApp.buyInsurance(flightId, {from: config.owner,value:web3.utils.toWei("1", "ether")}); 
      
    let ids = await config.flightSuretyData.getInsurancesByPassenger(config.owner); 
    let insuranceDetail = await config.flightSuretyData.getInsuranceDetail(ids);
    // ASSERT
    assert.equal(insuranceDetail.id, true,"register insurance");

  });
  it('processFlightStatus', async () => {     
    let STATUS_CODE_LATE_AIRLINE = 20;
    await config.flightSuretyApp.processFlightStatus(config.owner,config.flightOne.flight,config.flightOne.departureTime,STATUS_CODE_LATE_AIRLINE);
    let creditAmount = await config.flightSuretyApp.getCreditedAmount(config.owner);
    
    assert.equal(creditAmount > 0, true,"refund when flight is late"+ creditAmount);

  });
  
  it('withdraw creditedAmount', async () => {     
    await config.flightSuretyApp.withdrawCreditedAmount(config.owner);
    let reaminCreditAmount = await config.flightSuretyApp.getCreditedAmount(config.owner);
    let contractBalance = await config.flightSuretyData.getContractBalance.call();
    assert.equal(reaminCreditAmount == 0, true,"refund when flight is late"+ contractBalance);

  });
});
