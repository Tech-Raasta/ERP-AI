const { Country } = require("../models/country");

exports.createCountry = async (req, res, next) => {
  try {
    const country = new Country({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    country.getRequestData(req);

    const error = await country.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await country.save();

    return res.status(201).json({
      message: "Country added successfully",
      country: country
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a country failed!"
    // });

    res.statusCode = 500;
    res.message = "Creating a country failed!";
    next(error, req, res);
  }
};

exports.updateCountry = async (req, res, next) => {
  try {
    const country = await Country.findById({ _id: req.params.id });

    if (!country) {
      return res.status(404).json({
        message: "Country not found!"
      });
    }

    country.getRequestData(req);
    country.updatedBy = req.userData.userId;

    const error = await country.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await country.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Couldn't udpate country!"
    // });
    
    res.statusCode = 500;
    res.message = "Couldn't udpate country!";
    next(error, req, res);
  }
};

exports.getCountries = (req, res, next) => {
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;
  const countryQuery = Country.find();
  let fetchedCountrys;
  if (pageSize && currentPage) {
    countryQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  }
  countryQuery
    .then(documents => {
      fetchedCountrys = documents;
      return Country.count();
    })
    .then(count => {
      res.status(200).json({
        message: "Countries fetched successfully!",
        countrys: fetchedCountrys,
        maxCountrys: count
      });
    })
    .catch(error => {
      // res.status(500).json({
      //   message: "Fetching countries failed!"
      // });
      
      res.statusCode = 500;
      res.message = "Fetching countries failed!";
      next(error, req, res);
    });
};

exports.getCountry = async (req, res, next) => {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) {
      return res.status(404).json({ message: "Country not found!" });
    }
  
    return res.status(200).json({ country });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching country failed!"
    // });
      
    res.statusCode = 500;
    res.message = "Fetching country failed!";
    next(error, req, res);
  }
};

exports.deleteCountry = async (req, res, next) => {
  try {
    const country = await Country.findById({ _id: req.params.id });

    if (!country) {
      return res.status(404).json({
        message: "Country not found!"
      });
    }

    country.status = 'InActive';
    country.updatedBy = req.userData.userId;

    const error = await country.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await country.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting country failed!"
    // });
      
    res.statusCode = 500;
    res.message = "Deleting country failed!";
    next(error, req, res);
  }
};