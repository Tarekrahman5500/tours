import { oneway } from './centralApiSabreSearch';
export const centralAPiSabreSearchResult = async (req, res) => {
  const departure = req.body.departure ? req.body.departure?.toUpperCase() : '';
  const arrival =
    req.body.arrival?.toUpperCase() ||
    req.body.segmentsList[req.body.segmentsList?.length - 1].arrival;
  const departureDate =
    req.body.departureDate || req.body.segmentsList[0].departureDate;
  const arrivalDate = req.body.arrivalDate || '';
  const adultCount = Number.parseInt(req?.body?.adultCount || 0);
  const childCount = Number.parseInt(req?.body?.childCount || 0);
  const infantCount = Number.parseInt(req?.body?.infantCount || 0);
  const segmentsList = req.body.segmentsList;
  const cabin = req.body.cabin;
  const vendorPref = req.body.vendorPref || [];
  const studentFare = Boolean(req.body.studentFare);
  const umrahFare = Boolean(req.body.umrahFare);
  const seamanFare = Boolean(req.body.seamanFare);
  const arilinesCode = req.body.codes;
  const classes = req.body.classes;
  const name = req.body.pcc;
  const passengers = req.body.passengers;
  const centralSearchId = req.body.searchId;
  //const commission = req.body.commissionDetails;
  //console.log(commission);
  const sabreSearchResult = await oneway(
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
    umrahFare,
    seamanFare,
    arilinesCode,
    classes,
    name,
    passengers,
    centralSearchId
  );
  return sabreSearchResult;
};