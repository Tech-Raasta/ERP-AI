import ExhibitionVisitor from "../models/exhibitionVisitor.js";


export const createVisitor = async (req, res, next) => {
    try {
        
        const visitor = await ExhibitionVisitor.build({
            created_date: new Date().toISOString(),
        })

        visitor.getRequestData(req);
        await visitor.save();

        return res.status(201).json({
            message: "Business Created Successfully",
            visitor
        });
        
    } catch (error) {
        console.log('Sequelize Save Error:', error.message, error.errors);
        res.statusCode = 500;
        res.message = "Creating a Visitor failed!";
        next(error, req, res);
    }
}