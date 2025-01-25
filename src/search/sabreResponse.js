import axios from 'axios';
import moment from 'moment/moment';
import validateEnv from '../../../../config/validateEnv';
import { Constants } from '../../../../helpers/constant';
import { getActiveCoupons } from '../../../../search/cache';
import analyzeSegments from '../../../../search/helpers/analyzeSegments';
import getAirlinesByCode from '../../../../search/helpers/getAirlinesByCode';
import getCountryCodeByAirportCode from '../../../../search/helpers/getAirportByCode';
import getCityByCode from '../../../../search/helpers/getCityByCode';
import { getCredentials } from '../../../../share/GetCredentials';
import { fetchToken } from '../../utils/tokenUtils';
import { formatTime } from '../../utils/utils';
import { processBrandFeatures } from '../airSearchHelper/brandHelper';
import { processItineraries } from '../airSearchHelper/finalItenirary';
import { sabreAirSearchBody } from './centralApiSabreRequestBody';
import client from '../../../../database/redis/redisConnect';
import { aircraftName } from '../../helpers/aircraftHelper';
import { XMLParser, XMLValidator, JsArrBuilder } from 'fast-xml-parser';
import { generateUUID } from '../../../../helpers/uuid';
import { reIssueHeader, sessionEnd } from '../reissue/reIssueHeader';
export const oneway = async (
  departure,
  arrival,
  departureDate,
  arrivalDate,
  adultCount,
  childCount,
  infantCount,
  cabin,
  segmentsList,
  vendorPref,
  studentFare,
  umrahFare,
  seamanFare,
  arilinesCode,
  classes,
  name,
  passengers,
  centralSearchId
) => {
  // const controlQuery = await pool.query("SELECT * FROM control WHERE id=?", 1);
  const arrayResult = [];
  //for (const { pcc, userName, password } of credentialsManagerInstance.creds)
  const gds = await getCredentials(`${Constants.SEARCH}_${name}`);
  // console.log(gds, name)
  const pcc = gds.pcc;
  const userName = gds.userName;
  const password = gds.password;
  const type = await analyzeSegments(segmentsList);

  try {
    const couponData = await getActiveCoupons(pcc, type.commissionType);
    const filterCode = couponData;
    const accessToken = await fetchToken(userName, password, pcc);
    const authUrl = `${validateEnv.SABRE_SOAP_URL}`;
    const header = await reIssueHeader();
    const requestBody = await sabreAirSearchBody(
      departureDate,
      arrivalDate,
      departure,
      arrival,
      adultCount,
      childCount,
      infantCount,
      cabin,
      segmentsList,
      vendorPref,
      studentFare,
      seamanFare,
      pcc,
      arilinesCode,
      filterCode,
      passengers
    );
    // return requestBody;
    //console.log(JSON.stringify(requestBody));

    const headers = {
      'Content-Type': 'text/xml', // XML request body
    };

    const response = await axios.post(authUrl, requestBody, { headers });
    //return response.data;
    const options = {
      ignoreAttributes: false, // Include attributes in JSON
      attributeNamePrefix: '', // Prefix for attributes
      textNodeName: '#text', // Name for text nodes
      trimValues: true, // Remove whitespace around values
      only: ['OTA_AirLowFareSearchRS'],
    };
    const parser = new XMLParser(options);
    const parsedData = parser.parse(response.data);
    const data = parsedData['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'] || null;
    //return data;
    if (data.OTA_AirLowFareSearchRS.Errors) {
      return [];
    }
    const airportsInfo = await client.get('airports');
    const parsedAirportsInfo = JSON.parse(airportsInfo);
    const aircraftNameGet = await client.get('aircrafts');
    function airportsData(airportCode) {
      const matchingAirports = parsedAirportsInfo.filter(
        (airport) => airport.code === airportCode
      );
      return matchingAirports[0];
    }
    const airlinesData = await client.get('airlines');
    const parsedAirlines = JSON.parse(airlinesData);
    const parsedAircraft = JSON.parse(aircraftNameGet);
    function allAirlines(airlineCode) {
      const airlines = parsedAirlines.filter(
        (airport) => airport.code === airlineCode
      );
      return airlines[0];
    }
    let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    function aircraftName(aircraftCode) {
      const matchingAircraft = parsedAircraft.filter(
        (air) => air.airCraftId === aircraftCode
      );
      return matchingAircraft[0]?.aircraftModel || '';
    }
    const formatTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      const formattedTime = `${hours}H ${remainingMinutes}Min`;
      return formattedTime;
    };
    const mergeCharges = (data) => {
      const chargeMap = {};

      // Collect charges from "ProvisionType: C"
      data.forEach((item) => {
        if (item.ProvisionType === 'C' && item.charge) {
          const key = `${item.segmentIds.join(',')}-${item.paxType}`;
          if (!chargeMap[key]) {
            chargeMap[key] = { ...item.charge };
          } else {
            chargeMap[key].amount += item.charge.amount;
          }
        }
      });

      // Merge charges into "ProvisionType: A" and exclude "ProvisionType: C"
      return data
        .filter((item) => item.ProvisionType === 'A')
        .map((item) => {
          const key = `${item.segmentIds.join(',')}-${item.paxType}`;
          if (chargeMap[key]) {
            item.charge = chargeMap[key];
          }
          return item;
        });
    };
    function getBaggageDetails(baggage) {
      // Ensure baggage is always an array
      const baggageArray = Array.isArray(baggage) ? baggage : [baggage];

      // Collect baggage details from each element in the baggage array
      const allBaggageDetails = baggageArray.flatMap((item) => {
        const baggageInfo =
          item?.PassengerFare?.TPA_Extensions?.BaggageInformationList
            ?.BaggageInformation;
        const paxType = item?.PassengerTypeQuantity?.Code;
        const paxCount = Number(item?.PassengerTypeQuantity?.Quantity);

        if (!Array.isArray(baggageInfo)) {
          const weightMatch =
            baggageInfo?.Allowance?.Description1?.match(
              /(\d+)\s*POUNDS.*?(\d+)\s*KILOGRAMS/i
            ) || null;
          const weightInfo = weightMatch
            ? `${weightMatch[1]}Pounds or ${weightMatch[2]}Kilograms`
            : null;
          const weightInfoInKg = weightInfo ? weightMatch[2] : null;

          const dimensionMatch =
            baggageInfo?.Allowance?.Description2?.match(
              /(\d+)\s*LINEAR\s*INCHES\/(\d+)\s*LINEAR\s*CENTIMETERS/i
            ) || null;
          const dimensions = dimensionMatch
            ? `${dimensionMatch[1]}x${dimensionMatch[2]}CM`
            : null;
          return [
            {
              ProvisionType: baggageInfo.ProvisionType,
              paxType,
              paxCount,
              segmentIds: Array.isArray(baggageInfo?.Segment)
                ? baggageInfo.Segment.map((seg) => seg?.Id)
                : [baggageInfo?.Segment?.Id],
              baggage: baggageInfo.Allowance?.Weight
                ? `${
                    baggageInfo.Allowance?.Weight
                  }${baggageInfo.Allowance?.Unit.toUpperCase()}`
                : `${baggageInfo.Allowance?.Pieces}Piece`,
              weightInfo: weightInfo || weightInfoInKg || '',
              dimensions: dimensions || '',
              charge: baggageInfo?.Charge
                ? {
                    amount: Number(baggageInfo.Charge.EquivalentAmount) || null,
                    currency: baggageInfo?.Charge?.EquivalentCurrency || null,
                  }
                : null,
            },
          ];
        }

        // When baggageInfo is an array
        return baggageInfo.map((baggageItem) => {
          const weightMatch =
            baggageItem?.Allowance?.Description1?.match(
              /(\d+)\s*POUNDS.*?(\d+)\s*KILOGRAMS/i
            ) || null;
          const weightInfo = weightMatch
            ? `${weightMatch[1]}Pounds or ${weightMatch[2]}Kilograms`
            : null;
          const weightInfoInKg = weightInfo ? weightMatch[2] : null;

          const dimensionMatch =
            baggageItem?.Allowance?.Description2?.match(
              /(\d+)\s*LINEAR\s*INCHES\/(\d+)\s*LINEAR\s*CENTIMETERS/i
            ) || null;
          const dimensions = dimensionMatch
            ? `${dimensionMatch[1]}x${dimensionMatch[2]}CM`
            : null;
          return {
            ProvisionType: baggageItem.ProvisionType,
            paxType,
            paxCount,
            segmentIds: Array.isArray(baggageItem?.Segment)
              ? baggageItem.Segment.map((seg) => seg?.Id)
              : [baggageItem?.Segment?.Id],
            baggage: baggageItem.Allowance?.Weight
              ? `${
                  baggageItem.Allowance?.Weight
                }${baggageItem.Allowance?.Unit.toUpperCase()}`
              : `${baggageItem.Allowance?.Pieces}Piece`,
            weightInfo: weightInfo || weightInfoInKg || '',
            dimensions: dimensions || '',
            cabin: weightInfoInKg < 12 ? `${weightInfoInKg}` : '',
            charge: baggageItem?.Charge
              ? {
                  amount: Number(baggageItem.Charge.EquivalentAmount),
                  currency: baggageItem.Charge.EquivalentCurrency,
                }
              : null,
          };
        });
      });

      return allBaggageDetails;
    }
    function createCityCount(destination, seats, baggage) {
      const OriginDestinationOption = Array.isArray(
        destination.OriginDestinationOption
      )
        ? destination.OriginDestinationOption
        : [destination.OriginDestinationOption];
      const cityCount = [];

      // Iterate through each option in the OriginDestinationOption array
      for (let i = 0; i < OriginDestinationOption.length; i++) {
        const optionElapsedTime = OriginDestinationOption[i].ElapsedTime;
        const FlightSegments = OriginDestinationOption[i].FlightSegment;
        const segments = []; // Initialize segments array for each iteration

        // Iterate over the segments if FlightSegments is an array
        if (Array.isArray(FlightSegments)) {
          FlightSegments.forEach((segment, index) => {
            const hiddenStops = [];
            // Find the matching seat based on FareReference and bookingClass
            let matchedSeat;
            if (Array.isArray(seats)) {
              matchedSeat = seats.find(
                (seat) => seat?.FareReference === segment.ResBookDesigCode
              );
            } else {
              if (seats?.FareReference === segment.ResBookDesigCode) {
                matchedSeat = seats;
              }
            }

            const availableSeats = matchedSeat
              ? matchedSeat.TPA_Extensions.SeatsRemaining.Number
              : 0;
            const cabinCode = matchedSeat?.TPA_Extensions?.Cabin?.Cabin;
            const mealCode = matchedSeat?.TPA_Extensions?.Meal?.Code;
            if (FlightSegments?.StopAirports) {
              hiddenStops.push({
                departure: segment?.StopAirports?.StopAirport.LocationCode,
                airportName: airportsData(
                  segment?.StopAirports?.StopAirport.LocationCode
                ).name,
                cityCode: airportsData(
                  segment?.StopAirports?.StopAirport?.LocationCode
                ).cityCode,
                cityName: airportsData(
                  segment?.StopAirports?.StopAirport?.LocationCode
                ).cityName,
                countryName: regionNames.of(
                  airportsData(segment?.StopAirports?.StopAirport?.LocationCode)
                    .countryCode
                ),
                departureDate:
                  segment?.StopAirports?.StopAirport?.DepartureDateTime.slice(
                    0,
                    10
                  ),
                departureTime:
                  segment?.StopAirports?.StopAirport?.DepartureDateTime.slice(
                    11,
                    19
                  ),
                departureDateTime:
                  segment?.StopAirports?.StopAirport?.DepartureDateTime,
                arrivalDate:
                  segment?.StopAirports?.StopAirport?.ArrivalDateTime.slice(
                    0,
                    10
                  ),
                arrivalTime:
                  segment?.StopAirports?.StopAirport?.ArrivalDateTime.slice(
                    11,
                    19
                  ),
                arrivalDateTime:
                  segment?.StopAirports?.StopAirport?.ArrivalDateTime,
                elapsedTime: formatTime(
                  segment?.StopAirports?.StopAirport?.ElapsedTime
                ),
                elapsedLayOverTime: formatTime(
                  segment?.StopAirports?.StopAirport?.Duration
                ),
                aircraft: aircraftName(
                  segment?.StopAirports?.StopAirport?.Equipment
                ),
                stopLocation: `${
                  airportsData(segment?.StopAirports?.StopAirport?.LocationCode)
                    .cityName
                },${regionNames.of(
                  airportsData(
                    segment?.StopAirports?.StopAirport?.LocationCode || 'BD'
                  ).countryCode
                )}`,
              }) || [];
            }

            const allBags = getBaggageDetails(baggage);
            const result = mergeCharges(allBags);
            const filterById = (data, id) => {
              return data.filter((item) =>
                item.segmentIds.includes(id.toString())
              );
            };

            // Push each segment with availableSeats
            segments.push({
              id: index,
              codeShare:
                segment.MarketingAirline.Code !== segment.OperatingAirline.Code
                  ? true
                  : false,
              flightDurationInMinute: Number(segment.ElapsedTime),
              totalFlightDurationInMinutes: Number(optionElapsedTime),
              airCraft: aircraftName(segment.Equipment.AirEquipType),
              totalMilesFlown: Number(segment.TPA_Extensions.Mileage.Amount),
              departure: segment.DepartureAirport.LocationCode,
              departureCountryCode: airportsData(
                segment?.DepartureAirport?.LocationCode
              )?.countryCode,
              departureCountryName: regionNames.of(
                airportsData(segment?.DepartureAirport?.LocationCode)
                  ?.countryCode || 'BD'
              ),
              departureAirport: airportsData(
                segment?.DepartureAirport.LocationCode
              )?.name,
              departureCityCode: airportsData(
                segment.DepartureAirport.LocationCode
              )?.cityCode,
              departureCityName: airportsData(
                segment?.DepartureAirport?.LocationCode
              )?.cityName,
              arrivalAirport:
                airportsData(segment?.ArrivalAirport?.LocationCode)?.name || '',
              arrivalCityCode:
                airportsData(segment?.ArrivalAirport?.LocationCode)?.cityCode ||
                '',
              arrivalCityName:
                airportsData(segment?.ArrivalAirport?.LocationCode)?.cityName ||
                '',
              arrivalCountryCode:
                airportsData(segment?.ArrivalAirport?.LocationCode)
                  ?.countryCode || '',
              arrivalCountryName:
                regionNames.of(
                  airportsData(segment?.ArrivalAirport?.LocationCode)
                    ?.countryCode || 'BD'
                ) || '',
              departureLocation: `${
                airportsData(segment?.DepartureAirport?.LocationCode)?.cityName
              },${regionNames.of(
                airportsData(segment?.DepartureAirport.LocationCode)
                  ?.countryCode || 'BD'
              )}`,
              arrival: segment.ArrivalAirport.LocationCode,
              arrivalLocation:
                `${
                  airportsData(segment.ArrivalAirport.LocationCode)?.cityName ||
                  ''
                },${regionNames.of(
                  airportsData(segment?.ArrivalAirport?.LocationCode)
                    ?.countryCode || 'BD'
                )}` || '',
              marketingCarrier: segment?.MarketingAirline?.Code || '',
              marketingCarrierName:
                allAirlines(segment?.MarketingAirline?.Code)?.name || '',
              marketingFlight: Number(segment.FlightNumber),
              operatingCarrier: segment?.OperatingAirline?.Code || '',
              operatingCarrierName:
                allAirlines(segment?.OperatingAirline?.Code)?.name || '',
              operatingFlight: Number(segment.OperatingAirline.FlightNumber),
              departureDateTime: segment.DepartureDateTime,
              departureDate: segment.DepartureDateTime.slice(0, 10),
              departureTime: segment.DepartureDateTime.slice(11, 19),
              arrivalDateTime: segment.ArrivalDateTime,
              arrivalDate: segment.ArrivalDateTime.slice(0, 10),
              arrivalTime: segment.ArrivalDateTime.slice(11, 19),
              bookingClass: segment.ResBookDesigCode,
              flightDuration: formatTime(segment.ElapsedTime),
              totalFlightDuration: formatTime(optionElapsedTime),
              marriageGroup: segment.MarriageGrp,
              dTerminal:
                segment.DepartureAirport?.TerminalID?.length === 1
                  ? `Terminal ${segment.DepartureAirport.TerminalID}`
                  : segment.DepartureAirport.TerminalID || '',
              aTerminal:
                segment.ArrivalAirport?.TerminalID?.length === 1
                  ? `Terminal ${segment.ArrivalAirport.TerminalID}`
                  : segment.ArrivalAirport.TerminalID || '',
              cabinCode: '',
              mealCode: '',
              availableSeats: availableSeats, // Add availableSeats here
              cabinCode,
              mealCode,
              hiddenStops,
              baggage: filterById(result, index),
            });
          }); // Push all objects to segments
        } else {
          // If FlightSegments is not an array, use this block
          let matchedSeat;
          if (Array.isArray(seats)) {
            matchedSeat = seats.find(
              (seat) => seat.FareReference === FlightSegments.ResBookDesigCode
            );
          } else {
            if (seats.FareReference === FlightSegments.ResBookDesigCode) {
              matchedSeat = seats;
            }
          }

          const availableSeats = matchedSeat
            ? matchedSeat.TPA_Extensions.SeatsRemaining.Number
            : 0;
          const cabinCode = matchedSeat?.TPA_Extensions?.Cabin?.Cabin || '';
          const mealCode = matchedSeat?.TPA_Extensions?.Meal?.Code || '';

          const hiddenStops = [];
          if (FlightSegments?.StopAirports) {
            hiddenStops.push({
              departure: FlightSegments?.StopAirports?.StopAirport.LocationCode,
              airportName: airportsData(
                FlightSegments?.StopAirports?.StopAirport.LocationCode
              ).name,
              cityCode: airportsData(
                FlightSegments?.StopAirports?.StopAirport?.LocationCode
              ).cityCode,
              cityName: airportsData(
                FlightSegments?.StopAirports?.StopAirport?.LocationCode
              ).cityName,
              countryName: regionNames.of(
                airportsData(
                  FlightSegments?.StopAirports?.StopAirport?.LocationCode
                ).countryCode
              ),
              departureDate:
                FlightSegments?.StopAirports?.StopAirport?.DepartureDateTime.slice(
                  0,
                  10
                ),
              departureTime:
                FlightSegments?.StopAirports?.StopAirport?.DepartureDateTime.slice(
                  11,
                  19
                ),
              departureDateTime:
                FlightSegments?.StopAirports?.StopAirport?.DepartureDateTime,
              arrivalDate:
                FlightSegments?.StopAirports?.StopAirport?.ArrivalDateTime.slice(
                  0,
                  10
                ),
              arrivalTime:
                FlightSegments?.StopAirports?.StopAirport?.ArrivalDateTime.slice(
                  11,
                  19
                ),
              arrivalDateTime:
                FlightSegments?.StopAirports?.StopAirport?.ArrivalDateTime,
              elapsedTime: formatTime(
                FlightSegments?.StopAirports?.StopAirport?.ElapsedTime
              ),
              elapsedLayOverTime: formatTime(
                FlightSegments?.StopAirports?.StopAirport?.Duration
              ),
              aircraft: aircraftName(
                FlightSegments?.StopAirports?.StopAirport?.Equipment
              ),
              stopLocation: `${
                airportsData(
                  FlightSegments?.StopAirports?.StopAirport?.LocationCode
                ).cityName
              },${regionNames.of(
                airportsData(
                  FlightSegments?.StopAirports?.StopAirport?.LocationCode
                ).countryCode
              )}`,
            });
          }
          const allBags = getBaggageDetails(baggage);
          const result = mergeCharges(allBags);
          const filterById = (data, id) => {
            return data.filter((item) =>
              item.segmentIds.includes(id.toString())
            );
          };

          segments.push({
            id: i,
            codeShare:
              FlightSegments.MarketingAirline.Code !==
              FlightSegments.OperatingAirline.Code
                ? true
                : false,
            flightDurationInMinute: Number(FlightSegments.ElapsedTime),
            totalFlightDurationInMinutes: Number(optionElapsedTime),
            totalMilesFlown: Number(
              FlightSegments.TPA_Extensions.Mileage.Amount
            ),
            airCraft: aircraftName(FlightSegments.Equipment.AirEquipType),
            departure: FlightSegments.DepartureAirport.LocationCode,
            departureAirport: airportsData(
              FlightSegments.DepartureAirport.LocationCode
            ).name,
            departureCityCode: airportsData(
              FlightSegments.DepartureAirport.LocationCode
            ).cityCode,
            departureCityName: airportsData(
              FlightSegments.DepartureAirport.LocationCode
            ).cityName,
            departureCountryCode: airportsData(
              FlightSegments.DepartureAirport.LocationCode
            ).countryCode,
            departureCountryName: regionNames.of(
              airportsData(FlightSegments.DepartureAirport.LocationCode)
                .countryCode
            ),
            departureLocation: `${
              airportsData(FlightSegments.DepartureAirport.LocationCode)
                .cityName
            },${regionNames.of(
              airportsData(FlightSegments.DepartureAirport.LocationCode)
                .countryCode
            )}`,
            arrivalAirport:
              airportsData(FlightSegments?.ArrivalAirport?.LocationCode)
                ?.name || '',
            arrival: FlightSegments.ArrivalAirport.LocationCode,
            arrivalCityCode: airportsData(
              FlightSegments.ArrivalAirport.LocationCode
            ).cityCode,
            arrivalCityName: airportsData(
              FlightSegments.ArrivalAirport.LocationCode
            ).cityName,
            arrivalCountryCode: airportsData(
              FlightSegments.ArrivalAirport.LocationCode
            ).countryCode,
            arrivalCountryName: regionNames.of(
              airportsData(FlightSegments.ArrivalAirport.LocationCode)
                .countryCode
            ),
            arrivalLocation: `${
              airportsData(FlightSegments.ArrivalAirport.LocationCode).cityName
            },${regionNames.of(
              airportsData(FlightSegments.ArrivalAirport.LocationCode)
                .countryCode
            )}`,
            marketingCarrier: FlightSegments.MarketingAirline.Code,
            marketingCarrierName: allAirlines(
              FlightSegments.MarketingAirline.Code
            ).name,
            marketingFlight: Number(FlightSegments.FlightNumber),
            operatingCarrier: FlightSegments.OperatingAirline.Code,
            operatingCarrierName: allAirlines(
              FlightSegments.OperatingAirline.Code
            ).name,
            operatingFlight: Number(
              FlightSegments.OperatingAirline.FlightNumber
            ),
            departureDateTime: FlightSegments.DepartureDateTime,
            departureDate: FlightSegments.DepartureDateTime.slice(0, 10),
            departureTime: FlightSegments.DepartureDateTime.slice(11, 19),
            arrivalDateTime: FlightSegments.ArrivalDateTime,
            arrivalDate: FlightSegments.ArrivalDateTime.slice(0, 10),
            arrivalTime: FlightSegments.ArrivalDateTime.slice(11, 19),
            bookingClass: FlightSegments.ResBookDesigCode,
            flightDuration: formatTime(FlightSegments.ElapsedTime),
            totalFlightDuration: formatTime(optionElapsedTime),
            marriageGroup: FlightSegments.MarriageGrp,
            dTerminal:
              FlightSegments.DepartureAirport?.TerminalID?.length === 1
                ? `Terminal ${FlightSegments.DepartureAirport.TerminalID}`
                : FlightSegments.DepartureAirport.TerminalID || '',
            aTerminal:
              FlightSegments.ArrivalAirport?.TerminalID?.length === 1
                ? `Terminal ${FlightSegments.ArrivalAirport.TerminalID}`
                : FlightSegments.ArrivalAirport.TerminalID || '',
            cabinCode: '',
            mealCode: '',
            availableSeats: availableSeats, // Add availableSeats here
            cabinCode,
            mealCode,
            hiddenStops,
            baggage: filterById(result, i),
          });
        }
        cityCount.push(segments); // Push the segments array into cityCount
      }
      return cityCount;
    }
    function processTaxes(item) {
      // Use reduce to sum all the Amount values
      const totalAmount = item.reduce((acc, tax) => {
        // Add the current tax Amount to the accumulator
        return acc + Number(tax.Amount);
      }, 0); // Initialize the accumulator to 0

      return totalAmount;
    }
    const categorizePassenger = (passengers) => {
      // Initialize result object
      let result = {
        adult: null,
        child: null,
        infant: null,
      };

      passengers.forEach((passenger) => {
        const { type, count, ages } = passenger;

        if (type === 'ADT') {
          // Handle adults
          result.adult = { type, count };
        } else if (type === 'CNN') {
          // Handle children
          result.child = { type, count, ages: ages || [] };
        } else if (type === 'INF') {
          // Handle infants
          result.infant = { type, count };
        }
      });

      return result;
    };
    function priceBreakDownAll(price) {
      const priceBreakDown = []; // Array to hold the results

      if (Array.isArray(price.PTC_FareBreakdown)) {
        const categorizedPassengers = categorizePassenger(passengers);
        const kidsAges = [];
        const childAges = [];

        // Loop through ages and categorize as "kids" or "child"
        categorizedPassengers.child.ages.forEach((age) => {
          if (age >= 2 && age <= 4) {
            kidsAges.push(age); // Ages 2, 3, 4 are kids
          } else if (age >= 5) {
            childAges.push(age); // Ages 5 and above are children
          }
        });
        // If PTC_FareBreakdown is an array, push all its elements
        price?.PTC_FareBreakdown.forEach((item) =>
          priceBreakDown.push({
            age:
              item.PassengerTypeQuantity.Code >= 'C02' &&
              item.PassengerTypeQuantity.Code <= 'C04'
                ? kidsAges
                : item.PassengerTypeQuantity.Code >= 'C05' &&
                  item.PassengerTypeQuantity.Code <= 'C11'
                ? childAges
                : null,
            paxType:
              item.PassengerTypeQuantity.Code !== 'ADT' &&
              item.PassengerTypeQuantity.Code !== 'INF'
                ? 'CNN'
                : item.PassengerTypeQuantity.Code,
            paxCount: Number(item.PassengerTypeQuantity.Quantity),
            currency: item.PassengerFare.EquivFare.CurrencyCode,
            baseFare: Number(item.PassengerFare.EquivFare.Amount),
            tax: Number(item.PassengerFare.Taxes.TotalTax.Amount),
            totalTaxAmount:
              processTaxes(item.PassengerFare.Taxes.Tax) *
              Number(item.PassengerTypeQuantity.Quantity),
            totalBaseFare: Number(
              item.PassengerFare.EquivFare.Amount *
                item.PassengerTypeQuantity.Quantity
            ),
            totalAmount: Number(item.PassengerFare.TotalFare.Amount),
            discount: 0,
            otherCharges: 0,
            serviceFee: 0,
            allTax: item.PassengerFare.Taxes.Tax.map((taxCode) => {
              let modifiedTaxCode = taxCode.TaxCode
                ? taxCode.TaxCode.slice(0, 2)
                : '';
              return {
                code: modifiedTaxCode,
                amount: Number(taxCode.Amount),
                currency: taxCode.CurrencyCode,
              };
            }),
          })
        );
      } else {
        // If PTC_FareBreakdown is an object, push it directly
        priceBreakDown.push({
          age: null,
          paxType: price.PTC_FareBreakdown.PassengerTypeQuantity.Code,
          paxCount: Number(
            price.PTC_FareBreakdown.PassengerTypeQuantity.Quantity
          ),
          currency:
            price.PTC_FareBreakdown.PassengerFare.EquivFare.CurrencyCode,
          baseFare: Number(
            price.PTC_FareBreakdown.PassengerFare.EquivFare.Amount
          ),
          tax: Number(
            price.PTC_FareBreakdown.PassengerFare.Taxes.TotalTax.Amount
          ),
          totalTaxAmount:
            processTaxes(price.PTC_FareBreakdown.PassengerFare.Taxes.Tax) *
            Number(price.PTC_FareBreakdown.PassengerTypeQuantity.Quantity),
          totalBaseFare:
            Number(price.PTC_FareBreakdown.PassengerFare.EquivFare.Amount) *
            Number(price.PTC_FareBreakdown.PassengerTypeQuantity.Quantity),
          totalAmount: Number(
            price.PTC_FareBreakdown.PassengerFare.TotalFare.Amount
          ),
          discount: 0,
          otherCharges: 0,
          serviceFee: 0,
          allTax: price.PTC_FareBreakdown.PassengerFare.Taxes.Tax.map(
            (taxCode) => {
              let modifiedTaxCode = taxCode.TaxCode
                ? taxCode.TaxCode.slice(0, 2)
                : '';
              return {
                code: modifiedTaxCode,
                amount: Number(taxCode.Amount),
                currency: taxCode.CurrencyCode,
              };
            }
          ),
        });
      }
      return priceBreakDown;
    }
    function createPenaltiesInfo(Penalty) {
      const penaltiesInfo = Penalty?.map((penalty) => {
        const isRefundable =
          penalty.Type === 'Refund'
            ? penalty.Refundable === true
              ? 'Partially Refundable'
              : 'Non Refundable'
            : null; // Only set for "Refund"

        const isChangeable =
          penalty.Type !== 'Refund'
            ? penalty.isChangeable === true
              ? 'Changeable'
              : 'Non Changeable'
            : null; // Only set for non-"Refund"

        return {
          name:
            penalty.Type === 'Exchange'
              ? `Reissue ${penalty.Applicability} Departure`
              : `${penalty.Type} ${penalty.Applicability} Departure`,
          type: penalty.Type,
          amount: Number(penalty.Amount),
          message:
            penalty.Type === 'Exchange'
              ? `Reissue ${penalty.Applicability} Departure starts with ${penalty?.Amount} ${penalty?.CurrencyCode}`
              : `${penalty.Type} ${penalty.Applicability} Departure starts with ${penalty.Amount} ${penalty.CurrencyCode}`,
          currency: penalty.CurrencyCode,
          isRefundable: isRefundable, // Set only if the type is "Refund"
          isChangeable: isChangeable, // Set only if the type is not "Refund"
          applicability: penalty.Applicability,
        };
      });
      return penaltiesInfo || [];
    }
    const generateNumericUUID = () => {
      const now = Date.now(); // Get current timestamp in milliseconds
      const randomFactor = Math.floor(Math.random() * 1000); // Add some randomness to avoid collisions
      return `${now}${randomFactor}`;
    };
    function regularBrand(pricingInfo) {
      let price;
      if (Array.isArray(pricingInfo.PTC_FareBreakdown)) {
        price = pricingInfo.PTC_FareBreakdown[0];
      } else {
        price = pricingInfo.PTC_FareBreakdown;
      }
      let fareBasisCodes;
      if (Array.isArray(price?.FareBasisCodes?.FareBasisCode)) {
        fareBasisCodes = price?.FareBasisCodes?.FareBasisCode?.map(
          (fareCode) => {
            return {
              fareBasisCode: fareCode['#text'],
            };
          }
        );
      } else {
        fareBasisCodes = price?.FareBasisCodes?.FareBasisCode['#text'];
      }
      let seatInfo;
      if (Array.isArray(price?.FareInfos?.FareInfo)) {
        seatInfo = price?.FareInfos?.FareInfo.map((seat) => {
          return {
            bookingClass: seat.FareReference,
            seatsAvailable: seat.TPA_Extensions.SeatsRemaining.Number,
          };
        });
      } else {
        seatInfo = [
          {
            bookingClass: price?.FareInfos?.FareInfo?.FareReference,
            seatsAvailable:
              price?.FareInfos?.FareInfo?.TPA_Extensions?.SeatsRemaining
                ?.Number || null,
          },
        ];
      }
      let isRefundable;
      if (Array.isArray(pricingInfo?.PTC_FareBreakdown)) {
        isRefundable =
          pricingInfo?.PTC_FareBreakdown[0]?.Endorsements
            .NonRefundableIndicator === 'false'
            ? 'Partially Refundable'
            : 'Non Refundable';
      } else {
        isRefundable =
          pricingInfo?.PTC_FareBreakdown.Endorsements.NonRefundableIndicator ===
          'false'
            ? 'Partially Refundable'
            : 'Non Refundable';
      }
      const brandBaggage =
        pricingInfo?.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
          ?.BaggageInformationList?.BaggageInformation[0]?.Allowance ||
        pricingInfo?.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
          ?.BaggageInformationList?.BaggageInformation?.Allowance;
      const bagsType = brandBaggage?.Pieces
        ? `${brandBaggage.Pieces}Piece`
        : `${brandBaggage?.Weight}${brandBaggage?.Unit.toUpperCase()}`;
      const regularBaggage = [];
      regularBaggage.push({
        code: 'checkin bag',
        message: `FREE BAGGAGE ALLOWED UP TO A MAXIMUM WEIGHT OF ${bagsType}`,
      });
      regularBaggage.push({
        code: 'cabin bag',
        message: `1 CARRY ON BAGGAGE ALLOWED`,
      });
      let flattenedBreakDown;
      if (Array.isArray(pricingInfo.PTC_FareBreakdown)) {
        flattenedBreakDown =
          pricingInfo.PTC_FareBreakdown[0]?.PassengerFare?.TPA_Extensions
            ?.FareComponents?.FareComponent[0] ||
          pricingInfo.PTC_FareBreakdown[0]?.TPA_Extensions?.FareComponents
            ?.FareComponent;
      } else {
        flattenedBreakDown =
          pricingInfo.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
            ?.FareComponents?.FareComponent[0] ||
          pricingInfo.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
            ?.FareComponents?.FareComponent;
      }

      return {
        brandId: generateNumericUUID(),
        brandCode: 'RG',
        isRefundable,
        additionalFare: `+ 0 BDT`,
        additionalAmount: 0,
        brandName: 'REGULAR BRAND',
        baseFare: Number(price?.PassengerFare?.EquivFare?.Amount),
        currency: price?.PassengerFare?.EquivFare?.CurrencyCode,
        taxes: Number(price?.PassengerFare?.Taxes?.TotalTax?.Amount),
        totalFare: Number(price?.PassengerFare.TotalFare.Amount),
        baggage: brandBaggage?.Pieces
          ? `${brandBaggage.Pieces}Piece`
          : `${brandBaggage?.Weight}${brandBaggage?.Unit.toUpperCase()}`,
        baggageFeatures: regularBaggage,
        fareBasisCode: fareBasisCodes || [],
        seatInfo: seatInfo || [],
        othersFeatures: [],
        structure:
          createPenaltiesInfo(price?.PassengerFare.PenaltiesInfo.Penalty) || [],
      };
    }
    function createBrand(brandData, brandDesc, pricingInfo) {
      const regularBrandData = regularBrand(pricingInfo);
      const brands = [];
      if (brandData && Array.isArray(brandData)) {
        //console.log('1st condition entered');
        const filteredData = brandData?.filter(
          (item) =>
            item?.AirItineraryPricingInfo?.FareStatus !== 'F' &&
            item?.AirItineraryPricingInfo?.FareStatus !== 'O' &&
            item?.AirItineraryPricingInfo?.FareStatus !== 'A'
        );
        // Filter out objects where FareStatus is "F"
        let previousFare = Number(regularBrandData.totalFare);

        // Process each remaining AirItineraryPricingInfo object
        if (filteredData.length > 0)
          filteredData.forEach((item, index) => {
            const pricingInfo = item.AirItineraryPricingInfo;
            if (pricingInfo) {
              const { ItinTotalFare, PTC_FareBreakdowns, TPA_Extensions } =
                pricingInfo;

              const baseFare = Number(ItinTotalFare?.EquivFare?.Amount);
              const currency = ItinTotalFare?.EquivFare?.CurrencyCode;
              const tax = Number(ItinTotalFare?.Taxes?.Tax?.Amount);
              const totalFare = Number(ItinTotalFare?.TotalFare?.Amount);

              //const additionalFare = index === 0 ? 0 : totalFare - previousFare;
              const additionalFare = totalFare - previousFare;

              let flattenedBreakDown;
              if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
                flattenedBreakDown =
                  PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent[0] ||
                  PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent;
              } else {
                flattenedBreakDown =
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent[0] ||
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent;
              }

              let price;
              if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
                price = PTC_FareBreakdowns?.PTC_FareBreakdown[0] || [];
              } else {
                price = PTC_FareBreakdowns?.PTC_FareBreakdown || {};
              }
              let fareBasisCodes;
              if (Array.isArray(price?.FareBasisCodes?.FareBasisCode)) {
                fareBasisCodes = price?.FareBasisCodes?.FareBasisCode?.map(
                  (fareCode) => {
                    return {
                      fareBasisCode: fareCode['#text'],
                    };
                  }
                );
              } else {
                fareBasisCodes = price?.FareBasisCodes?.FareBasisCode['#text'];
              }
              let seatInfo;
              if (Array.isArray(price?.FareInfos?.FareInfo)) {
                seatInfo = price?.FareInfos?.FareInfo.map((seat) => {
                  return {
                    bookingClass: seat.FareReference,
                    seatsAvailable: seat.TPA_Extensions.SeatsRemaining.Number,
                  };
                });
              } else {
                seatInfo = [
                  {
                    bookingClass: price?.FareInfos?.FareInfo?.FareReference,
                    seatsAvailable:
                      price?.FareInfos?.FareInfo?.TPA_Extensions?.SeatsRemaining
                        ?.Number || null,
                  },
                ];
              }
              let brandId;
              if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
                brandId =
                  PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent[0]
                    ?.BrandFeatureRef ||
                  PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent
                    ?.BrandFeatureRef;
              } else {
                brandId =
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent[0]
                    ?.BrandFeatureRef ||
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                    ?.TPA_Extensions?.FareComponents?.FareComponent
                    ?.BrandFeatureRef;
              }

              const brandCode = flattenedBreakDown?.BrandID;
              const brandName = flattenedBreakDown?.BrandName;
              let allBrand = [];
              brandId?.forEach((feature) => {
                const brandRef = brandDesc.find(
                  (desc) => desc.Id === feature.FeatureId
                );
                allBrand.push(brandRef);
              });
              let isRefundable;
              if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
                isRefundable =
                  PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.Endorsements
                    .NonRefundableIndicator === 'false'
                    ? 'Partially Refundable'
                    : 'Non Refundable';
              } else {
                isRefundable =
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.Endorsements
                    .NonRefundableIndicator === 'false'
                    ? 'Partially Refundable'
                    : 'Non Refundable';
              }
              const brandBaggage =
                PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                  ?.TPA_Extensions?.BaggageInformationList.BaggageInformation[0]
                  ?.Allowance ||
                PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                  ?.TPA_Extensions?.BaggageInformationList.BaggageInformation
                  ?.Allowance ||
                PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                  ?.TPA_Extensions?.BaggageInformationList.BaggageInformation[0]
                  ?.Allowance;
              const bagsType = brandBaggage?.Pieces
                ? `${brandBaggage.Pieces}Piece`
                : `${brandBaggage?.Weight}${brandBaggage?.Unit.toUpperCase()}`;
              const othersFeatures =
                processBrandFeatures(
                  allBrand?.map((feature) => {
                    return {
                      id: feature?.Id,
                      application:
                        feature.Application === 'C'
                          ? 'Charge Applicable'
                          : feature.Application === 'F'
                          ? 'Free'
                          : feature.Application === 'N'
                          ? 'Not Offered'
                          : feature.Application,
                      type: feature?.ServiceType,
                      code: feature?.ServiceGroup,
                      commercialName: feature?.CommercialName,
                    };
                  }) || []
                ) || [];
              const baggageFeatures = [];
              let miles = {};
              othersFeatures?.forEach((feature) => {
                if (feature?.baggageFeatures) {
                  baggageFeatures.push(...feature?.baggageFeatures);
                }
                if (feature?.miles) {
                  miles = feature?.miles;
                }
              });
              const regularBaggage = [];
              regularBaggage.push({
                code: 'checkin bag',
                message: `FREE BAGGAGE ALLOWED UP TO A MAXIMUM WEIGHT OF ${bagsType}`,
              });
              regularBaggage.push({
                code: 'cabin bag',
                message: `1 CARRY ON BAGGAGE ALLOWED`,
              });

              brands.push({
                brandId: generateNumericUUID(),
                brandCode: brandCode || '',
                isRefundable,
                additionalFare:
                  additionalFare >= 0
                    ? `+ ${additionalFare} BDT`
                    : `- ${additionalFare} BDT`,
                additionalAmount: additionalFare,
                brandName: brandName || '',
                baseFare: baseFare || '',
                currency: currency || '',
                taxes: tax || '',
                totalFare: totalFare || '',
                fareBasisCode: fareBasisCodes || [],
                seatInfo: seatInfo || [],
                baggage: bagsType,
                structure:
                  createPenaltiesInfo(
                    PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                      .PenaltiesInfo.Penalty ||
                      PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                        .PenaltiesInfo.Penalty
                  ) || [],
                othersFeatures:
                  othersFeatures?.filter(
                    (feature) => !feature?.baggageFeatures && !feature?.miles
                  ) || [],
                baggageFeatures:
                  baggageFeatures.length > 0 ? baggageFeatures : regularBaggage,
                miles: Object.keys(miles).length ? miles : {},
              });
              const regularBrandDataExists = brands.some(
                (brand) => brand.brandCode === regularBrandData.brandCode
              );
              if (!regularBrandDataExists) {
                brands.push(regularBrandData);
              }
            }
          });
      } else if (brandData) {
        //console.log('2nd condition entered');
        const pricingInfo = brandData.AirItineraryPricingInfo;
        let previousFare = regularBrandData.totalFare;

        if (
          pricingInfo &&
          pricingInfo.FareStatus !== 'F' &&
          pricingInfo.FareStatus !== 'O' &&
          pricingInfo.FareStatus !== 'A'
        ) {
          const { ItinTotalFare, PTC_FareBreakdowns, TPA_Extensions } =
            pricingInfo;
          const baseFare = Number(ItinTotalFare?.EquivFare?.Amount);
          const currency = ItinTotalFare?.EquivFare?.CurrencyCode;
          const tax = Number(ItinTotalFare?.Taxes?.Tax?.Amount);
          const totalFare = Number(ItinTotalFare?.TotalFare?.Amount);
          const additionalFare = totalFare - previousFare;

          let flattenedBreakDown;
          if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
            flattenedBreakDown =
              PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent[0] ||
              PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent;
          } else {
            flattenedBreakDown =
              PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent[0] ||
              PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent;
          }
          let price;
          if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
            price = PTC_FareBreakdowns?.PTC_FareBreakdown[0] || [];
          } else {
            price = PTC_FareBreakdowns?.PTC_FareBreakdown || {};
          }
          let fareBasisCodes;
          if (Array.isArray(price?.FareBasisCodes?.FareBasisCode)) {
            fareBasisCodes = price?.FareBasisCodes?.FareBasisCode?.map(
              (fareCode) => {
                return {
                  fareBasisCode: fareCode['#text'],
                };
              }
            );
          } else {
            fareBasisCodes = price?.FareBasisCodes?.FareBasisCode['#text'];
          }
          //seat info
          let seatInfo;
          if (Array.isArray(price?.FareInfos?.FareInfo)) {
            seatInfo = price?.FareInfos?.FareInfo.map((seat) => {
              return {
                bookingClass: seat.FareReference,
                seatsAvailable: seat.TPA_Extensions.SeatsRemaining.Number,
              };
            });
          } else {
            seatInfo = [
              {
                bookingClass: price?.FareInfos?.FareInfo?.FareReference,
                seatsAvailable:
                  price?.FareInfos?.FareInfo?.TPA_Extensions?.SeatsRemaining
                    ?.Number || null,
              },
            ];
          }

          let brandId;
          if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
            brandId =
              PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent[0]
                ?.BrandFeatureRef ||
              PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent
                ?.BrandFeatureRef;
          } else {
            brandId =
              PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent[0]
                ?.BrandFeatureRef ||
              PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                ?.TPA_Extensions?.FareComponents?.FareComponent
                ?.BrandFeatureRef;
          }

          const brandCode = flattenedBreakDown?.BrandID || 'RG';
          const brandName = flattenedBreakDown?.BrandName || 'REGULAR BRAND';
          let allBrand = [];
          brandId?.forEach((feature) => {
            const brandRef = brandDesc.find(
              (desc) => desc.Id === feature.FeatureId
            );
            allBrand.push(brandRef);
          });
          let isRefundable;
          if (Array.isArray(PTC_FareBreakdowns?.PTC_FareBreakdown)) {
            isRefundable =
              PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.Endorsements
                .NonRefundableIndicator === 'false'
                ? 'Partially Refundable'
                : 'Non Refundable';
          } else {
            isRefundable =
              PTC_FareBreakdowns?.PTC_FareBreakdown?.Endorsements
                .NonRefundableIndicator === 'false'
                ? 'Partially Refundable'
                : 'Non Refundable';
          }
          const brandBaggage =
            PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
              ?.BaggageInformationList?.BaggageInformation[0]?.Allowance ||
            PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare?.TPA_Extensions
              ?.BaggageInformationList?.BaggageInformation?.Allowance;

          const bagsType = brandBaggage?.Pieces
            ? `${brandBaggage.Pieces}Piece`
            : `${brandBaggage?.Weight}${brandBaggage?.Unit.toUpperCase()}`;
          const othersFeatures =
            processBrandFeatures(
              allBrand?.map((feature) => {
                return {
                  id: feature?.Id,
                  application:
                    feature.Application === 'C'
                      ? 'Charge Applicable'
                      : feature.Application === 'F'
                      ? 'Free'
                      : feature.Application === 'N'
                      ? 'Not Offered'
                      : feature.Application,
                  type: feature?.ServiceType,
                  code: feature?.ServiceGroup,
                  commercialName: feature?.CommercialName,
                };
              }) || []
            ) || [];
          const baggageFeatures = [];
          let miles = {};
          othersFeatures?.forEach((feature) => {
            if (feature?.baggageFeatures) {
              baggageFeatures.push(...feature?.baggageFeatures);
            }
            if (feature?.miles) {
              miles = feature?.miles;
            }
          });
          const regularBaggage = [];
          regularBaggage.push({
            code: 'checkin bag',
            message: `FREE BAGGAGE ALLOWED UP TO A MAXIMUM WEIGHT OF ${bagsType}`,
          });
          regularBaggage.push({
            code: 'cabin bag',
            message: `1 CARRY ON BAGGAGE ALLOWED`,
          });
          brands.push({
            brandId: generateNumericUUID(),
            brandCode: brandCode || '',
            isRefundable,
            additionalFare: `+ ${additionalFare} BDT`,
            additionalAmount: additionalFare,
            brandName: brandName || '',
            baseFare: baseFare || '',
            currency: currency || '',
            taxes: tax || '',
            totalFare: totalFare || '',
            fareBasisCode: fareBasisCodes || [],
            seatInfo: seatInfo || [],
            baggage: bagsType,
            structure:
              createPenaltiesInfo(
                PTC_FareBreakdowns?.PTC_FareBreakdown[0]?.PassengerFare
                  .PenaltiesInfo.Penalty ||
                  PTC_FareBreakdowns?.PTC_FareBreakdown?.PassengerFare
                    .PenaltiesInfo.Penalty
              ) || [],
            othersFeatures:
              processBrandFeatures(
                allBrand?.map((feature) => {
                  return {
                    id: feature?.Id,
                    application:
                      feature.Application === 'C'
                        ? 'Charge Applicable'
                        : feature.Application,
                    type: feature?.ServiceType,
                    code: feature?.ServiceGroup,
                    commercialName: feature?.CommercialName,
                  };
                }) || []
              ) || [],
          });
          const regularBrandDataExists = brands.some(
            (brand) => brand.brandCode === regularBrandData.brandCode
          );
          if (!regularBrandDataExists) {
            brands.push(regularBrandData);
          }
        } else {
          brands.push(regularBrandData);
        }
      } else {
        // console.log('3rd condition entered');
        const regularBrandData = regularBrand(pricingInfo, generateNumericUUID);
        brands.push(regularBrandData);
      }
      return brands;
    }
    const itineraries =
      data.OTA_AirLowFareSearchRS.PricedItineraries.PricedItinerary;
    const result = [];
    for (let i = 0; i < itineraries.length; i++) {
      const single = itineraries[i];
      const OriginDestinationOptions =
        single.AirItinerary.OriginDestinationOptions;
      const AirItineraryPricingInfo =
        single.AirItineraryPricingInfo.ItinTotalFare;
      const ValidatingCarrier = single.TPA_Extensions.ValidatingCarrier.Code;
      const ptcBreakDown = single?.TPA_Extensions?.AdditionalFares;

      const carrierName = allAirlines(
        single?.TPA_Extensions?.ValidatingCarrier?.Code
      )?.name;
      const cityCount = createCityCount(
        OriginDestinationOptions,
        single?.AirItineraryPricingInfo?.FareInfos?.FareInfo,
        single?.AirItineraryPricingInfo?.PTC_FareBreakdowns?.PTC_FareBreakdown
      );
      const tripType =
        single.AirItinerary.DirectionInd === 'Other'
          ? 'multiCity'
          : single.AirItinerary.DirectionInd;

      const baseFare = Number(AirItineraryPricingInfo.EquivFare.Amount);
      const clientPrice = Number(AirItineraryPricingInfo.TotalFare.Amount);
      const tax = Number(AirItineraryPricingInfo.Taxes.Tax.Amount);
      const priceBreakDownFn = priceBreakDownAll(
        single.AirItineraryPricingInfo.PTC_FareBreakdowns
      );
      const brandDesc =
        data?.OTA_AirLowFareSearchRS?.BrandFeatures?.BrandFeature || [];
      const brand = createBrand(
        ptcBreakDown,
        brandDesc,
        single.AirItineraryPricingInfo.PTC_FareBreakdowns
      );
      let isRefundable;
      if (
        Array.isArray(
          single.AirItineraryPricingInfo.PTC_FareBreakdowns.PTC_FareBreakdown
        )
      ) {
        isRefundable =
          single.AirItineraryPricingInfo.PTC_FareBreakdowns.PTC_FareBreakdown[0]
            .Endorsements.NonRefundableIndicator === 'false'
            ? 'Partially Refundable'
            : 'Non Refundable';
      } else {
        isRefundable =
          single.AirItineraryPricingInfo.PTC_FareBreakdowns.PTC_FareBreakdown
            .Endorsements.NonRefundableIndicator === 'false'
            ? 'Partially Refundable'
            : 'Non Refundable';
      }
      const allTransitTimes = [];
      for (const segments of cityCount) {
        const transitTimes = [];
        if (segments.length < 2) {
        } else {
          for (let i = 1; i < segments.length; i++) {
            const segment = segments[i];
            const previousSegment = segments[i - 1];

            // Combine arrival date and time
            const arrivalDateTime =
              previousSegment?.arrivalDate && previousSegment?.arrivalTime
                ? `${previousSegment.arrivalDate} ${previousSegment.arrivalTime}`
                : null;

            // Combine departure date and time
            const departureDateTime =
              segment?.departureDate && segment?.departureTime
                ? `${segment.departureDate} ${segment.departureTime}`
                : null;

            if (departureDateTime && arrivalDateTime) {
              const departureMoment = moment(
                departureDateTime,
                'YYYY-MM-DD HH:mm:ss'
              );
              const arrivalMoment = moment(
                arrivalDateTime,
                'YYYY-MM-DD HH:mm:ss'
              );

              if (departureMoment.isValid() && arrivalMoment.isValid()) {
                const duration = moment.duration(
                  departureMoment.diff(arrivalMoment) // Difference in milliseconds
                );

                const hours = Math.floor(duration.asHours());
                const minutes = duration.minutes();

                transitTimes.push({ transit: `${hours}H ${minutes}Min` });
              }
            }
          }
        }
        allTransitTimes.push(transitTimes);
      }
      const allBaggage = [];
      cityCount?.forEach((baggage) => {
        const getBags = baggage.map((bags) => bags.baggage);
        allBaggage.push(getBags[0]);
      });
      function extractProperties(data) {
        return data.map((innerArray) =>
          innerArray.map((segment) => ({
            departure: segment.departure,
            arrival: segment.arrival,
            departureDate: segment.departureDate,
            arrivalDate: segment.arrivalDate,
            departureDateTime: segment.departureDateTime,
            arrivalDateTime: segment.arrivalDateTime,
            operatingCarrier: segment.operatingCarrier,
            marketingCarrier: segment.marketingCarrier,
            marketingFlight: Number(segment.marketingFlight),
            operatingFlight: Number(segment.operatingFlight),
            bookingClass: segment.bookingClass,
          }))
        );
      }
      const airPriceData = [];
      airPriceData.push({
        studentFare,
        seamanFare,
        system: 'sabre',
        cityCount: extractProperties(cityCount),
        segmentsList,
      });
      const determineClass = async () => {
        if (cabin === 'Business') {
          return 'Business[C]';
        } else if (cabin === 'PremiumFirst') {
          return 'Premium First[P]';
        } else if (cabin === 'PremiumBusiness') {
          return 'Premium Business[J]';
        } else if (cabin === 'Economy') {
          return 'Economy[Y]';
        } else if (cabin === 'PremiumEconomy') {
          return 'Premium Economy[S]';
        }
      };
      const determineClassResult = await determineClass();
      const typeObject = await analyzeSegments(segmentsList);

      result.push({
        uuid: generateUUID(),
        system: 'sabre',
        pcc: '14KK',
        centralSearchId: centralSearchId,
        studentFare: false,
        seamanFare: false,
        immediateIssue: false,
        partialPayment: false,
        commissionType: typeObject.commissionType,
        journeyType: typeObject.journeyType,
        tripType:
          tripType.toLowerCase() === 'oneway'
            ? 'oneWay'
            : tripType.toLowerCase() === 'multicity'
            ? 'multiCity'
            : tripType.toLowerCase() || '',
        airPriceData: airPriceData,
        baseFare,
        taxes: tax,
        totalFare: clientPrice,
        isRefundable,
        transit: allTransitTimes,
        class: determineClassResult,
        route: segmentsList,
        amenities: [],
        carrier: ValidatingCarrier,
        carrierName,
        baggage: allBaggage,
        brandCount: brand.length,
        brands: brand.sort((a, b) => a.totalFare - b.totalFare),
        priceBreakdown: priceBreakDownFn,
        cityCount: cityCount,
      });
    }
    const filteredResults = result.filter((item) => {
      const cityCountFlat = item.cityCount.flat();

      // Check if there is a matching class in cityCount and classes
      const hasMatchingClass = cityCountFlat.some((city) => {
        return classes.some(
          (c) =>
            c.airlineCode === item.carrier && c.className === city.bookingClass
        );
      });
      // Check if the vendorPerf matches the carrier
      const hasMatchingVendor =
        vendorPref.length === 0 || vendorPref.includes(item.carrier);

      // Keep the item if the vendorPerf matches, and it doesn't have a matching class
      return hasMatchingVendor && !hasMatchingClass;
    });
    if (filteredResults.length > 0) {
      await sessionEnd();
    }
    return filteredResults;
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
};