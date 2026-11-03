const { State } = require("../models/state");
const { Country } = require("../models/country");

exports.createState = async (req, res, next) => {
  try {
    const state = new State({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    state.getRequestData(req);

    const error = await state.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await state.save();

    return res.status(201).json({
      message: "State added successfully",
      state: state
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a state failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a State failed!";
    next(error, req, res);
  }
};

exports.updateState = async (req, res, next) => {
  try {
    const state = await State.findById({ _id: req.params.id });

    if (!state) {
      return res.status(404).json({
        message: "State not found!"
      });
    }

    state.getRequestData(req);
    state.updatedBy = req.userData.userId;

    const error = await state.validateData();
    // console.log(error);
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await state.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Couldn't udpate state!"
    // });
    
    res.statusCode = 500;
    res.message = "Couldn't udpate State!";
    next(error, req, res);
  }
};

exports.getStates = (req, res, next) => {
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;
  const stateQuery = State.find();
  let fetchedStates;
  if (pageSize && currentPage) {
    stateQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  }
  stateQuery
    .populate('country', 'countryName')
    .then(documents => {
      fetchedStates = documents;
      return State.count();
    })
    .then(count => {
      res.status(200).json({
        message: "States fetched successfully!",
        states: fetchedStates,
        maxStates: count
      });
    })
    .catch(error => {
      // res.status(500).json({
      //   message: "Fetching states failed!"
      // });
    
      res.statusCode = 500;
      res.message = "Fetching States failed!";
      next(error, req, res);
    });
};

exports.getState = async (req, res, next) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) {
      return res.status(404).json({ message: "State not found!" });
    }
  
    const countries = await Country.find().select('countryName');
  
    return res.status(200).json({ state, countries });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching state failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching State failed!";
    next(error, req, res);
  }
};

exports.deleteState = async (req, res, next) => {
  try {
    const state = await State.findById({ _id: req.params.id });

    if (!state) {
      return res.status(404).json({
        message: "State not found!"
      });
    }

    state.status = 'InActive';
    state.updatedBy = req.userData.userId;

    const error = await state.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await state.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting state failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting State failed!";
    next(error, req, res);
  }
};