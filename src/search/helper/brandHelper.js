const patterns = {
    baggagePattern:
      /(HAND BAGGAGE|CABIN BAGS|FREE BAG|BAGGAGE ALLOWANCE|UP TO \d+KG BAGGAGE|CARRY\d+KG \d+LBUPTO \d+LI \d+LCM|CHECKED BAGGAGE \d+X \d+KG|CHECKED BAGGAGE UP TO \d+ KGS|CHECKED BAGGAGE|MAX \d+PC OR TTL \d+KG \d+LCM|1ST BAG MAX \d+KG \d+LB \d+LCM|2ND BAG MAX \d+KG \d+LB \d+LCM|MAX \d+PC OR TTL \d+KG \d+LCM|1PC MAX \d+KG \d+LCM EACH|UPTO\d+LB \d+KG BAGGAGE)/,
    milesPattern: /(MILES EARNED|MILES|QMILES ACCUMULATION|EXTRA MILES)/,
    typeChecks: [
      /PREMIUM CHECK IN/,
      /BID TO UPGRADE/,
      /FAST TRACK/,
      /CHILD DISCOUNT/,
      /NO SHOW/,
      /GO SHOW/,
      /EXCESS WEIGHT SPECIAL CHARGE/,
      /INFANT DISCOUNT/,
      /ADVANCE PURCHASE/,
      /INTERNET ACCESS/,
      /SEAT SELECTION STANDARD ZONE/,
      /EXTRA LEGROOM SEAT SELECTION/,
      /CHANGE FEE/,
      /NO SHOW FEE/,
      /SAME DAY CHANGE/,
      /PRIORITY ACCESS/,
      /GOLF EQUIPMENT UP TO 15 KG/,
      /PREMIUM CATERING/,
      /PRIORITY BAGGAGE/,
      /MILEAGE ACCRUAL/,
      /PLUS ACCRUAL/,
      /OTHER SEAT TYPES/,
      /QMILES/,
      /MILES/,
      /SAMEDAY CHANGE TO EARLY FLIGHT/,
      /PRIORITY SERVICES/,
      /BASIC SEAT/,
      /CARRY14KG/,
      /BAG/,
      /BAGGAGE/,
      /NEIGHBOUR FREE SEAT/,
    ],
  };
  const codes = ['BF', 'LG', 'ML', 'SA'];
  export function processBrandFeatures(brandFeatures) {
    const smallestBaggageItems = {};
    let largestMilesFeature = null;
    let largestMilesPercent = -Infinity;
    const othersFeatures = [];
  
    brandFeatures?.forEach((item) => {
      // Check for baggage features
      if (patterns.baggagePattern.test(item.commercialName)) {
        const weightMatch = item.commercialName.match(/(\d+)\s*KGS?/);
        const weight = weightMatch ? parseInt(weightMatch[1], 10) : Infinity;
        const pcMatch = item.commercialName.match(
          /(\d+)\s*(PC|PCS|PIECE|PIECES)/
        );
        const pc = pcMatch ? parseInt(pcMatch[1], 10) : Infinity;
        const lbMatch = item.commercialName.match(/(\d+)\s*LB/);
        const lb = lbMatch ? parseInt(lbMatch[1], 10) : 0;
        const liMatch = item.commercialName.match(/(\d+)\s*LI/);
        const li = liMatch ? parseInt(liMatch[1], 10) : 0;
        const lcmMatch = item.commercialName.match(/(\d+)\s*LCM/);
        const lcm = lcmMatch ? parseInt(lcmMatch[1], 10) : 0;
        if (
          !smallestBaggageItems[item.code] ||
          smallestBaggageItems[item.code].weight > weight ||
          (smallestBaggageItems[item.code].weight === weight &&
            smallestBaggageItems[item.code].pc > pc)
        ) {
          smallestBaggageItems[item.code] = {
            id: item.id,
            application: item.application,
            code: item.code,
            type: item.type,
            commercialName: item.commercialName,
            item,
            weight,
            pc,
            lb,
            li,
            lcm,
          };
        }
      }
  
      // Check for miles features
      if (patterns.milesPattern.test(item.commercialName)) {
        const percentMatch = item.commercialName.match(/(\d+)\s*PERCENT/);
        const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;
  
        if (percent > largestMilesPercent) {
          largestMilesPercent = percent;
          largestMilesFeature = {
            code: 'miles',
            commercialName: item.commercialName,
            percent,
          };
        }
      }
  
      const getUpdatedCode = (commercialName) => {
        if (commercialName.includes('UPGRADE')) {
          return 'upgrade';
        } else if (commercialName.includes('LOUNGE')) {
          return 'lounge';
        } else if (
          commercialName.includes('MEAL') ||
          commercialName.includes('BEVERAGE') ||
          commercialName.includes('SANDWICH MENU')
        ) {
          return 'meals';
        } else if (commercialName.includes('PRIORITY')) {
          return 'priority';
        } else if (
          commercialName.includes('SEATS') ||
          commercialName.includes('VISTARA SELECT') ||
          commercialName.includes('SEAT')
        ) {
          return 'seat';
        } else if (
          commercialName === 'REFUND BEFORE DEPARTURE CHANGE ALLOWED FOR FREE' ||
          commercialName === 'REFUND AFTER DEPARTURE CHANGE ALLOWED FOR FREE' ||
          commercialName.includes('REFUND BEFORE DEPARTURE') ||
          commercialName.includes('REFUND AFTER DEPARTURE') ||
          commercialName.includes('REFUND ALLOWED,BEFORE DEPARTURE') ||
          commercialName.includes('REFUND ALLOWED,AFTER DEPARTURE') ||
          commercialName === 'REFUND ANYTIME CHANGE ALLOWED FOR 0 BDT' ||
          commercialName === 'REFUNDABLE TICKET'
        ) {
          return 'refund';
        } else if (
          commercialName === 'CHANGE ALLOWED,BEFORE DEPARTURE ALLOWED FOR FREE' ||
          commercialName === 'CHANGE ALLOWED,AFTER DEPARTURE ALLOWED FOR FREE' ||
          commercialName.includes('CHANGE ALLOWED,BEFORE DEPARTURE') ||
          commercialName.includes('CHANGE ALLOWED,AFTER DEPARTURE') ||
          commercialName === 'CHANGE ANYTIME ALLOWED FOR 0 BDT' ||
          commercialName === 'CHANGEABLE TICKET'
        ) {
          return 'reissue';
        } else if (
          commercialName.includes('CHANGE ALLOWED,BEFORE DEPARTURE') ||
          commercialName.includes('CHANGE ALLOWED,AFTER DEPARTURE') ||
          commercialName.includes('REFUND ALLOWED,BEFORE DEPARTURE CHARGE') ||
          commercialName.includes('REFUND ALLOWED,AFTER DEPARTURE CHARGE') ||
          commercialName.includes('CHANGE ANYTIME ALLOWED') ||
          commercialName.includes('CHANGE ANYTIME') ||
          commercialName.includes('REFUND ANYTIME ALLOWED')
        ) {
          return 'money';
        } else if (commercialName.includes('MILES')) {
          return 'miles';
        }
        return 'others';
      };
      // Check for specific codes
      if (
        codes.includes(item.code) &&
        !(
          item.code === 'BF' &&
          patterns.typeChecks.some((pattern) => pattern.test(item.commercialName))
        )
      ) {
        othersFeatures.push({
          id: item.id,
          application: item.application,
          code: getUpdatedCode(item.commercialName),
          type: item.type,
          message: item.commercialName,
        });
      }
    });
  
    const smallestBaggageFeatures = Object.values(smallestBaggageItems).map(
      ({ item, weight, pc, lb, li, lcm }) => {
        let commercialName = item?.commercialName;
  
        if (item?.commercialName.includes('FREE BAG')) {
          commercialName = `FREE BAG ALLOWED ${pc}PC UP TO ${weight}KG`;
        } else if (item?.commercialName.includes('CARRY ON HAND BAGGAGE')) {
          commercialName = `HAND BAGGAGE ALLOWED`;
        } else if (
          item?.commercialName.includes('CABIN BAGS') ||
          item?.commercialName.includes('HAND')
        ) {
          commercialName = `HAND BAGGAGE ALLOWED UP TO ${weight}KG`;
        } else if (item?.commercialName.includes('CHECK IN BAG')) {
          commercialName = `CHECK IN BAGGAGE ALLOWED`;
        } else if (
          item?.commercialName.includes('FREE CHECKED BAGGAGE ALLOWANCE')
        ) {
          commercialName = `CHECKIN BAGGAGE ALLOWED`;
        } else if (
          item?.commercialName.includes('BAGGAGE ALLOWANCE') ||
          item?.commercialName.includes('UP TO')
        ) {
          commercialName = `CHECKIN BAGGAGE ALLOWED UP TO ${weight}KG`;
        } else if (item?.commercialName.includes('CARRY')) {
          commercialName = `CARRY BAGGAGE ALLOWED ${weight}KG`;
        } else if (item?.commercialName.includes('CHECKED BAGGAGE')) {
          const pieces = item?.commercialName.match(/(\d+)\s*X/);
          const piecesCount = pieces ? pieces[1] : '';
          commercialName = `CHECKIN BAGGAGE ALLOWED ${
            piecesCount ? piecesCount + 'X' : ''
          } ${weight ? weight + 'KG' : ''}`;
        } else if (item?.commercialName.includes('MAX')) {
          const pcMatch = item?.commercialName.match(/(\d+)\s*PC/);
          const maxPc = pcMatch ? parseInt(pcMatch[1], 10) : pc;
          commercialName = `CHECKIN BAGGAGE ALLOWED MAX ${maxPc}PC OR ${weight}KG`;
        } else if (
          item?.commercialName.includes('1ST BAG MAX') ||
          item?.commercialName.includes('2ND BAG MAX')
        ) {
          commercialName = `CHECKIN BAGGAGE ALLOWED MAX ${weight}KG`;
        } else if (item?.commercialName.includes('UPTO')) {
          commercialName = `CHECKIN BAGGAGE ALLOWED UP TO ${weight}KG ${lb}LB`;
        } else if (
          item?.commercialName.includes('EXCESS BAG') ||
          item?.commercialName.includes('CHECKED BAG') ||
          item?.commercialName.includes('FREE CHECKED BAGGAGE ALLOWANCE')
        ) {
          commercialName = `STANDARED BAGGAGE`;
        }
        // else {
        //   commercialName = `CHECKIN BAGGAGE ALLOWED UP TO ${weight}KG`;
        // }
        return {
          id: item?.id,
          application: item.application,
          code: item?.code,
          type: item?.type,
          commercialName,
        };
      }
    );
  
    const filteredBaggageInfo = {};
    smallestBaggageFeatures.forEach((item) => {
      const keyMatchFreeBag = item.commercialName.match(
        /FREE BAG ALLOWED (\d+)PC UP TO (\d+)KG/
      );
      const keyMatchMax = item.commercialName.match(
        /CHECKIN BAGGAGE ALLOWED MAX (\d+)PC OR (\d+)KG/
      );
      const keyMatchX = item.commercialName.match(
        /CHECKIN BAGGAGE ALLOWED (\d+)X (\d+)KG/
      );
      const keyMatchUpTo = item.commercialName.match(
        /CHECKIN BAGGAGE ALLOWED UP TO (\d+)KG/
      );
      const keyMatchUptoLB = item.commercialName.match(
        /CHECKIN BAGGAGE ALLOWED UP TO (\d+)KG (\d+)LB/
      );
  
      if (keyMatchFreeBag) {
        const pc = parseInt(keyMatchFreeBag[1], 10);
        const weight = parseInt(keyMatchFreeBag[2], 10);
        const key = 'FREE BAG';
        if (
          !filteredBaggageInfo[key] ||
          filteredBaggageInfo[key].weight > weight ||
          (filteredBaggageInfo[key].weight === weight &&
            filteredBaggageInfo[key].pc > pc)
        ) {
          filteredBaggageInfo[key] = { ...item, weight, pc };
        }
      } else if (keyMatchMax) {
        const pc = parseInt(keyMatchMax[1], 10);
        const weight = parseInt(keyMatchMax[2], 10);
        const key = 'MAX';
  
        if (
          !filteredBaggageInfo[key] ||
          filteredBaggageInfo[key].weight > weight ||
          (filteredBaggageInfo[key].weight === weight &&
            filteredBaggageInfo[key].pc > pc)
        ) {
          filteredBaggageInfo[key] = { ...item, weight, pc };
        }
      } else if (keyMatchX) {
        const pieces = parseInt(keyMatchX[1], 10);
        const weight = parseInt(keyMatchX[2], 10);
        const key = 'X';
  
        if (
          !filteredBaggageInfo[key] ||
          filteredBaggageInfo[key].weight > weight ||
          (filteredBaggageInfo[key].weight === weight &&
            filteredBaggageInfo[key].pieces > pieces)
        ) {
          filteredBaggageInfo[key] = { ...item, weight, pieces };
        }
      } else if (keyMatchUpTo) {
        const weight = parseInt(keyMatchUpTo[1], 10);
        const key = 'UP TO';
  
        if (
          !filteredBaggageInfo[key] ||
          filteredBaggageInfo[key].weight > weight
        ) {
          filteredBaggageInfo[key] = { ...item, weight };
        }
      } else if (keyMatchUptoLB) {
        const weight = parseInt(keyMatchUptoLB[1], 10);
        const lb = parseInt(keyMatchUptoLB[2], 10);
        const key = 'UP TO LB KG';
  
        if (
          !filteredBaggageInfo[key] ||
          filteredBaggageInfo[key].weight > weight ||
          (filteredBaggageInfo[key].weight === weight &&
            filteredBaggageInfo[key].lb > lb)
        ) {
          filteredBaggageInfo[key] = { ...item, weight, lb };
        }
      } else {
        filteredBaggageInfo[item.commercialName] = item;
      }
    });
    const finalBaggageInfo = Object.values(filteredBaggageInfo).map(
      ({ id, code, type, commercialName }) => ({
        id,
        code,
        type,
        commercialName,
      })
    );
    const modifiedBaggageFeature = finalBaggageInfo.map((item) => {
      let newCode = item.code;
      if (item.commercialName.includes('CARRY')) {
        newCode = 'cabin bag';
      } else if (item.commercialName.includes('CABIN')) {
        newCode = 'cabin bag';
      } else if (item.commercialName.includes('CHECKIN')) {
        newCode = 'checkin bag';
      } else if (item.commercialName.includes('HAND')) {
        newCode = 'cabin bag';
      } else if (item.commercialName.includes('FREE BAG')) {
        newCode = 'checkin bag';
      }
      return {
        code: newCode,
        message: item.commercialName,
      };
    });
    return [
      ...othersFeatures,
      {
        baggageFeatures: modifiedBaggageFeature,
        miles: largestMilesFeature ? { ...largestMilesFeature } : null,
      },
    ];
  }