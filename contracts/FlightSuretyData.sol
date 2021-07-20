pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
   
    struct AirlineDetail {        
        uint id;
        bool isVoter;
        bool isPaidRegistrationFee;
    }
     struct FlightDetail {
        uint id;
        string flight;
        bytes32 key;
        address airline;
        bool isActiveForInsurance;
        uint departureTimestamp;
        uint8 departureStatusCode;
        uint updatedTimestamp;
    }
    enum InsuranceStatus {Active, Expired, Credited}
    struct InsuranceDetail {
        uint id;
        uint flightId;
        InsuranceStatus status;
        uint cost;
        address owner;
    }   
     mapping(uint => InsuranceDetail) public insurancesById;
    mapping(address => uint[]) private passengerToInsurances;
    mapping(uint => uint[]) private flightToInsurances;
    mapping(uint => FlightDetail) private flightList;
    mapping(bytes32 => uint) flightKeyToId;
    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false    
    mapping(address => AirlineDetail) public airlineList;
    uint256 private totalAirline = 0;
    uint256 public totalFlight = 0;
    uint256 private totalInsurance = 0;
     mapping(address => uint) public creditedAmounts;
     
    event AirlineRegistered(address airline);
    event FlightRegistered(string flight,  uint256 timestamp);
    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor() public payable{
        contractOwner = msg.sender;        
        totalAirline++;          
        airlineList[msg.sender] = AirlineDetail({ id: totalAirline, isVoter: false,isPaidRegistrationFee:true});  
        address(this).transfer(msg.value);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireDuplicatedAirline(address airlineAddress) {
        require(!(airlineList[airlineAddress].id > 0), "The airline is already registered");
        _;
    }
    
    modifier requireAirlineExists(address airlineAddress) {
        require(airlineList[airlineAddress].id > 0, "The airline is not  registered");
        _;
    }
    
    modifier requireFlightExists(uint _id) {
        require(flightList[_id].id > 0, "This fight is not registered");
        _;
    }

    modifier requireFlightNotDeparted(uint _timestamp){
        require(_timestamp > block.timestamp, "Flight has been departed already, so it makes no sense to sell insurances for it.");
        _;
    }
   modifier requireFlightIsActiveForInsurance(uint _flightId)
    {
        require(flightList[_flightId].isActiveForInsurance, "The flight is not active for insurance");
        _;
    }

    modifier requireInsuranceExists(uint _id)
    {
        require(insurancesById[_id].id > 0, "Insurance does not exists in the system");
        _;
    }

    modifier requireInsuranceCanBeCredited(uint _id)
    {
        require(uint(insurancesById[_id].status) == 0, "The insurance can not be credited, b/c it is not Active");
        _;
    }

    modifier requireCanBeWithdrawn(address _address)
    {
        require(0 < creditedAmounts[_address], "The address does not have requested amount of funds to withdraw");
        _;
    }
    
    modifier requireContractHasSufficientFunds(address _address) {
        require(address(this).balance >= creditedAmounts[_address], "Contract does not have sufficient funds");
        _;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
    
    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return operational;
    }
    function getContractBalance() public view returns (uint) {
        return address(this).balance;
    }
    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
     /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
     function addAirline
    (address airlineAddress)
    requireIsOperational
    requireDuplicatedAirline(airlineAddress)
    public
    { 
        totalAirline++;
        airlineList[airlineAddress] = AirlineDetail({ id: totalAirline, isVoter: false,isPaidRegistrationFee:false }); 
        emit AirlineRegistered(airlineAddress);
   
    }
    function isAirline(address airlineAddress) requireIsOperational public view returns(bool isRegistered)
    {
        isRegistered = airlineList[airlineAddress].id > 0;
    }
    function getAirlineDetail(address airlineAddress) requireIsOperational public view returns(uint id, bool isVoter,bool isPaidRegistrationFee)
    {
        AirlineDetail airline = airlineList[airlineAddress];
        id = airline.id;
        isVoter = airline.isVoter;
        isPaidRegistrationFee = airline.isPaidRegistrationFee;
    }
    
    function setAirlineIsVoter
    (address airlineAddress)
    requireIsOperational
    requireAirlineExists(airlineAddress)
    public
    {
        airlineList[airlineAddress].isVoter = true;
    }
    function getTotallAirlines
    ()
    requireIsOperational
    public
    view
    returns (uint)
    {
        return (totalAirline);
    }

    function addFlight
    (string _flight, uint _departureTime,address airlineAddress)
    requireIsOperational
    requireAirlineExists(airlineAddress)
    requireFlightNotDeparted(_departureTime)
    public
    {
        totalFlight++;
        bytes32 key = getFlightKey(airlineAddress, _flight, _departureTime);
        flightList[totalFlight] = FlightDetail(
            {id: totalFlight,
            flight: _flight,
            key: key,
            airline: airlineAddress,
            isActiveForInsurance: true,
            departureTimestamp: _departureTime,
            departureStatusCode: 0,
            updatedTimestamp: block.timestamp});
        flightKeyToId[key] = totalFlight;  
        emit FlightRegistered(_flight, _departureTime);
    }
    function isFlight(address airlineAddress) requireIsOperational public view returns(bool isRegistered)
    {
        isRegistered = airlineList[airlineAddress].id > 0;
    }
     function getFlightDetail
    (uint _id)
    requireIsOperational
    requireFlightExists(_id)
    public
    view
    returns(uint id,string flight,bytes32 key,address airline,bool isActiveForInsurance,uint departureTimestamp,uint8 departureStatusCode,uint updatedTimestamp)
    {
       FlightDetail flightDetail = flightList[_id];
        id = flightDetail.id;
        flight = flightDetail.flight;
        key = flightDetail.key;
        airline = flightDetail.airline;
        isActiveForInsurance = flightDetail.isActiveForInsurance;
        departureStatusCode = flightDetail.departureStatusCode;
        departureTimestamp = flightDetail.departureTimestamp;
        updatedTimestamp = flightDetail.updatedTimestamp;
    }

    
    function getFlightIdByKey
    (bytes32 _key)
    requireIsOperational
    external
    view
    returns (uint)
    {
        return flightKeyToId[_key];
    }
    function setDisableInsurance
    (uint _id)
    requireIsOperational
    requireFlightExists(_id)
    public
    {
        flightList[_id].isActiveForInsurance = false;
        flightList[_id].updatedTimestamp = block.timestamp;
    }
    function setActiveInsurance
    (uint _id)
    requireIsOperational
    requireFlightExists(_id)
    public
    {
        flightList[_id].isActiveForInsurance = true;
        flightList[_id].updatedTimestamp = block.timestamp;
    }

    function setDepartureStatusCode
    (uint _id, uint8 _statusCode)
    requireIsOperational
    requireFlightExists(_id)
    public
    {
        flightList[_id].departureStatusCode = _statusCode;
        flightList[_id].updatedTimestamp = block.timestamp;
    }
    function addInsurance
    (uint _flightId, uint _cost, address _owner)
    requireIsOperational
    requireFlightExists(_flightId)
    requireFlightIsActiveForInsurance(_flightId)
    external
    {
        totalInsurance++;
        insurancesById[totalInsurance] = InsuranceDetail(
            {id: totalInsurance,
            flightId: _flightId,
            status: InsuranceStatus.Active,
            cost: _cost,
            owner: _owner});
        flightToInsurances[_flightId].push(totalInsurance);
        passengerToInsurances[_owner].push(totalInsurance);
    }

    function getInsurancesByFlight
    (uint _flightId)
    requireIsOperational
    requireFlightExists(_flightId)
    public
    view
    returns (uint [])
    {
        return flightToInsurances[_flightId];
    }

    function getInsurancesByPassenger
    (address _address)
    requireIsOperational
    public
    view
    returns (uint [])
    {
        return passengerToInsurances[_address];
    }
    function getInsuranceDetail(uint _id)    
    requireIsOperational
    requireInsuranceExists(_id)
    public
    view
    returns (uint id,uint flightId,uint status,uint cost,address owner)
    {
        InsuranceDetail memory insurance = insurancesById[_id];
        id = insurance.id;
        flightId = insurance.flightId;
        status = uint(insurance.status);
        cost = insurance.cost;
        owner = insurance.owner;
    }

    function creditInsurance
    (uint _id, uint _amountToCredit)
    requireIsOperational
    requireInsuranceExists(_id)
    requireInsuranceCanBeCredited(_id)
    public
    {
        InsuranceDetail memory insurance = insurancesById[_id];
        creditedAmounts[insurance.owner] = creditedAmounts[insurance.owner].add(_amountToCredit);
        insurancesById[_id].status = InsuranceStatus.Credited;
    }

    // Credited Amount Resource
    function getCreditedAmount
    (address _address)
    requireIsOperational
    public
    view
    returns (uint amountCredited)
    {
        amountCredited = creditedAmounts[_address];
    }

    function withdrawCreditedAmount
    (address _address)
    requireIsOperational
    requireCanBeWithdrawn( _address)
    requireContractHasSufficientFunds(_address)
    public
    payable
    {
        uint _amountToWithdraw = creditedAmounts[_address];
        creditedAmounts[_address] = 0;
        _address.transfer(_amountToWithdraw);
    }
    
    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
    }
}
