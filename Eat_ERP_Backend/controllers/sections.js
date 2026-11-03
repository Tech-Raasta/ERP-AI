const { Section } = require("../models/section");

exports.createSection = async (req, res, next) => {
  try {
    const section = new Section({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await section.getRequestData(req);

    // console.log(section);

    const error = await section.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await section.save();

    return res.status(201).json({
      message: "Section added successfully",
      section: section
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a section failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Section failed!";
    next(error, req, res);
  }
};

exports.updateSection = async (req, res, next) => {
  try {
    const section = await Section.findById({ _id: req.params.id });

    if (!section) {
      return res.status(404).json({
        message: "Section not found!"
      });
    }

    await section.getRequestData(req);
    section.updatedBy = req.userData.userId;

    const error = await section.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await section.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate section!"
    // });
    
    res.statusCode = 500;
    res.message = "Couldn't udpate section!";
    next(error, req, res);
  }
};

exports.getSections = (req, res, next) => {
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;
  const sectionQuery = Section.find();
  let fetchedSections;
  if (pageSize && currentPage) {
    sectionQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  }
  sectionQuery
    .sort('type sectionName')
    .then(documents => {
      fetchedSections = documents;
      return Section.count();
    })
    .then(count => {
      res.status(200).json({
        message: "Sections fetched successfully!",
        sections: fetchedSections,
        maxSections: count
      });
    })
    .catch(error => {
      // res.status(500).json({
      //   message: "Fetching sections failed!"
      // });
    
      res.statusCode = 500;
      res.message = "Fetching Sections failed!";
      next(error, req, res);
    });
};

exports.getSection = async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: "Section not found!" });
    }
    
    return res.status(200).json({ section });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching section failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Section failed!";
    next(error, req, res);
  }
};

exports.deleteSection = async (req, res, next) => {
  try {
    const section = await Section.findById({ _id: req.params.id });

    if (!section) {
      return res.status(404).json({
        message: "Section not found!"
      });
    }

    section.status = 'InActive';
    section.updatedBy = req.userData.userId;

    const error = await section.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await section.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting section failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Section failed!";
    next(error, req, res);
  }
};