export const sabreAirSearchBody = async (
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
    removeCarrier = arilinesCode,
    filterCode,
    passengers
  ) => {
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
          result.adult = { type, count };
        } else if (type === 'CNN') {
          result.child = { type, count, ages: ages || [] };
        } else if (type === 'INF') {
          result.infant = { type, count };
        }
      });
      return result;
    };
  
    const categorizedPassengers = categorizePassenger(passengers);
    let code;
  
    if (studentFare === true) {
      code = 'STU';
    } else if (seamanFare === true) {
      code = 'SEA';
    } else {
      code = 'ADT';
    }
    const passengerTypeQuantity = [];
    if (categorizedPassengers.adult?.count > 0) {
      passengerTypeQuantity.push({
        Code: code,
        Quantity: categorizedPassengers.adult.count,
        TPA_Extensions: {
          VoluntaryChanges: {
            Match: 'All',
          },
        },
      });
    }
    const processChildPassengers = (categorizedPassengers) => {
      const kidsAges = [];
      const childAges = [];
  
      // Loop through ages and categorize as "kids" or "child"
      categorizedPassengers.child.ages.forEach((age) => {
        if (age >= 2 && age <= 4) {
          kidsAges.push(age); // Ages 2, 3, 4 are kids
        } else if (age >= 5 && age <= 11) {
          childAges.push(age); // Ages 5 to 11 are children
        }
      });
  
      // Push the kids category (age 2-4) into passengerTypeQuantity
      kidsAges.forEach((age) => {
        passengerTypeQuantity.push({
          Code: `C${age.toString().padStart(2, '0')}`, // Dynamic Code based on age (e.g., C02, C03, etc.)
          Quantity: kidsAges.length, // Each age is counted individually
          TPA_Extensions: {
            VoluntaryChanges: {
              Match: 'All',
            },
          },
        });
      });
  
      // Push the child category (age 5-11) dynamically into passengerTypeQuantity
      childAges.forEach((age) => {
        passengerTypeQuantity.push({
          Code: `C${age.toString().padStart(2, '0')}`, // Dynamic Code based on age (e.g., C05, C06, etc.)
          Quantity: childAges.length, // Each age is counted individually
          TPA_Extensions: {
            VoluntaryChanges: {
              Match: 'All',
            },
          },
        });
      });
    };
    processChildPassengers(categorizedPassengers);
  
    if (categorizedPassengers.infant?.count > 0) {
      passengerTypeQuantity.push({
        Code: 'INF',
        Quantity: categorizedPassengers.infant.count,
        TPA_Extensions: {
          VoluntaryChanges: {
            Match: 'All',
          },
        },
      });
    }
    const header = await reIssueHeader();
    const OriginDestinationInformation = segmentsList
      .map((segment, index) => {
        return `
        <OriginDestinationInformation RPH="${index + 1}">
          <DepartureDateTime>${segment.departureDate}T${moment().format(
          'hh:mm:ss'
        )}</DepartureDateTime>
          <OriginLocation LocationCode="${segment.departure}"/>
          <DestinationLocation LocationCode="${segment.arrival}"/>
        </OriginDestinationInformation>
      `;
      })
      .join('');
  
    const passenger = passengerTypeQuantity
      .map((passenger) => {
        return `
        <PassengerTypeQuantity Code="${passenger.Code}" Quantity="${passenger.Quantity}">
          <TPA_Extensions>
            <VoluntaryChanges Match="${passenger.TPA_Extensions.VoluntaryChanges.Match}"/>
          </TPA_Extensions>
        </PassengerTypeQuantity>
      `;
      })
      .join('');
    // Unacceptable
    const vendor =
      removeCarrier
        ?.map((code) => {
          return `
          <VendorPref Code="${code}" PreferLevel="Unacceptable" Type="Marketing"/>
        `;
        })
        .join('') || '';
    const promoCode =
      filterCode
        ?.map((code) => {
          return `
            <AccountCode Code="${code}"/>
        `;
        })
        .join('') || '';
  
    return `
    <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
    ${header}
      <soap-env:Body>
     <OTA_AirLowFareSearchRQ Version="6.2.0" ResponseType="OTA" xmlns="http://www.opentravel.org/OTA/2003/05">
      <POS>
          <Source PseudoCityCode="${pcc}">
              <RequestorID ID="1" Type="1">
                  <CompanyName Code="TN"/>
              </RequestorID>
          </Source>
      </POS>
    ${OriginDestinationInformation} 
      <TravelPreferences ValidInterlineTicket="true">
      ${vendor}
          <CabinPref Cabin="${cabin}" PreferLevel="Preferred"/>
          <Baggage RequestType="C" Description="true" FreePieceRequired="true" />
      </TravelPreferences>
      <TravelerInfoSummary>
             <SeatsRequested>${
               adultCount + childCount + infantCount
             }</SeatsRequested>
          <AirTravelerAvail>
               ${passenger}
          </AirTravelerAvail>
          <PriceRequestInformation>
            ${promoCode}
              <TPA_Extensions>
                  <BrandedFareIndicators MultipleBrandedFares="true" ReturnBrandAncillaries="true"/>
              </TPA_Extensions>
          </PriceRequestInformation>
      </TravelerInfoSummary>
      <TPA_Extensions>
          <IntelliSellTransaction>
              <RequestType Name="50ITINS"/>
          </IntelliSellTransaction>
      </TPA_Extensions>
  </OTA_AirLowFareSearchRQ>
  
       </soap-env:Body>
      </soap-env:Envelope>
    `;
  };