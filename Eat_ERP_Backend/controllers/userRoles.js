const UserRole = require("../models/userRole");
const { Section } = require("../models/section");

exports.createUserRole = async (req, res, next) => {
  try {
    const userRole = new UserRole({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await userRole.getRequestData(req);

    // console.log(userRole);

    const error = await userRole.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await userRole.save();

    return res.status(201).json({
      message: "User Role added successfully",
      userRole: userRole
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a User Role failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Creating a User Role failed!";
    next(error, req, res);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const userRole = await UserRole.findById({ _id: req.params.id });

    if (!userRole) {
      return res.status(404).json({
        message: "User Role not found!"
      });
    }

    await userRole.getRequestData(req);
    userRole.updatedBy = req.userData.userId;

    const error = await userRole.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await userRole.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate User Role!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Couldn't udpate User Role!";
    next(error, req, res);
  }
};

exports.getUserRoles = (req, res, next) => {
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;
  const userRoleQuery = UserRole.find().sort('-updatedAt');
  let fetchedUserRoles;
  if (pageSize && currentPage) {
    userRoleQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  }
  userRoleQuery
    .then(documents => {
      fetchedUserRoles = documents;
      return UserRole.count();
    })
    .then(count => {
      res.status(200).json({
        message: "User Roles fetched successfully!",
        userRoles: fetchedUserRoles,
        maxUserRoles: count
      });
    })
    .catch(error => {
      // res.status(500).json({
      //   message: "Fetching User Roles failed!",
      //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
      // });
    
      res.statusCode = 500;
      res.message = "Fetching User Roles failed!";
      next(error, req, res);
    });
};

exports.getUserRole = async (req, res, next) => {
  try {
    const userRole = await UserRole.findById(req.params.id).lean();
    if (!userRole) {
      return res.status(404).json({ message: "User Role not found!" });
    }
    
    const sections = await Section.find().sort('type sectionName').lean();
    for (const userRoleSection of userRole.sections) {
      const index = sections.findIndex(section => section._id.toString() === userRoleSection._id.toString());
      if (index !== -1) {
        sections[index].view = userRoleSection.view;
        sections[index].insert = userRoleSection.insert;
        sections[index].update = userRoleSection.update;
        sections[index].delete = userRoleSection.delete;
        sections[index].approve = userRoleSection.approve;
        sections[index].download = userRoleSection.download;
      }
    }
  
    return res.status(200).json({ userRole, sections });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching User Role failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching User Role failed!";
    next(error, req, res);
  }
};

exports.deleteUserRole = async (req, res, next) => {
  try {
    const userRole = await UserRole.findById({ _id: req.params.id });

    if (!userRole) {
      return res.status(404).json({
        message: "User Role not found!"
      });
    }

    userRole.status = 'InActive';
    userRole.updatedBy = req.userData.userId;

    const error = await userRole.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await userRole.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting User Role failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Deleting User Role failed!";
    next(error, req, res);
  }
};