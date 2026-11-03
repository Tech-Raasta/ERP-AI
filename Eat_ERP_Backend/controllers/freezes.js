const { connection } = require("mongoose");
const Freeze = require("../models/freeze");
const Report = require("../models/report");

exports.createFreeze = async (req, res, next) => {
  let session;

  try {
    const freeze = new Freeze({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await freeze.getRequestData(req);

    // console.log(freeze);

    const error = await freeze.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await freeze.setMonthDate();

    // console.log(req.body);
    req.body = {
      ...req.body,
      freeze: true,
      fromDate: freeze.startDate,
      toDate: freeze.endDate
    };
    const data = await Report.getSellSummaryReport(req);
    freeze.report = data.fileName ? data.fileName : '';
    // console.log(req.body);

    session = await connection.startSession();
    session.startTransaction();
    await freeze.freezeData();
    await freeze.save();
    await session.commitTransaction();

    return res.status(201).json({
      message: "Freeze added successfully",
      freeze: freeze
    });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Creating a freeze failed!"
    // });
      
    res.statusCode = 500;
    res.message = "Creating a freeze failed!";
    next(error, req, res);
  }
};

exports.getFreezes = async (req, res, next) => {
  try {
    const financialYear = req.params.financialYear;
    if (!financialYear) {
      return res.status(404).json({ message: "Financial Year not found!" });
    }
    // if (financialYear.length != 7) {
    //   return res.status(404).json({ message: "Financial Year not found!" });
    // }
    // if (isNan(year)) {
    //   return res.status(404).json({ message: "Year not found!" });
    // }

    const freezedMonths = await Freeze.find({ financialYear: financialYear });

    // const months = [];
    // for (let month = 0; month < 12; month++) {
    //   const checkDate = new Date(year + '-' + month + '-01');
    //   const currentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    //   if (checkDate.getTime() < currentDate.getTime()) {
    //       months.push({
    //           month: month,
    //           monthName: new Date(year, month, 1).toLocaleDateString('default', { month: 'long' }),
    //           freezed: 0,
    //           report: ''
    //       });
    //   }
    // }
    
    return res.status(200).json({ freezedMonths });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Freezed Months failed!"
    // });
      
    res.statusCode = 500;
    res.message = "Fetching Freezed Months failed!";
    next(error, req, res);
  }
};

// exports.getFreeze = async (req, res, next) => {
//   try {
//     const freeze = await Freeze.findById(req.params.id);
//     if (!freeze) {
//       return res.status(404).json({ message: "Freeze not found!" });
//     }
    
//     const states = await State.find().select('_id stateName stateCode country');
//     const countries = await Country.find().select('_id countryName countryCode');
  
//     return res.status(200).json({ freeze, states, countries });
//   } catch (error) {
//     res.status(500).json({
//       message: "Fetching freeze failed!"
//     });
//   }
// };
