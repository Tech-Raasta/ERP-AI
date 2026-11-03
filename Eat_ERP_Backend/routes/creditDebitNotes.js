import express from "express";

import * as CreditDebitNoteController from "../controllers/creditDebitNotes.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

// Credit Debit Note (Transaction -> Bank, old PHP Credit_debit_note); access from the 'Credit_Debit_Note' role section
router.get("", checkAuth, CreditDebitNoteController.getCreditDebitNotes);

router.get("/master", checkAuth, CreditDebitNoteController.getMasterData);

router.get("/distributor", checkAuth, CreditDebitNoteController.getDistributorDetails);

router.get("/print/:id", checkAuth, CreditDebitNoteController.getCreditDebitNotePrint);

router.put("/approve/:id", checkAuth, CreditDebitNoteController.approveCreditDebitNote);

router.put("/reject/:id", checkAuth, CreditDebitNoteController.rejectCreditDebitNote);

router.get("/:id", checkAuth, CreditDebitNoteController.getCreditDebitNote);

router.post("", checkAuth, CreditDebitNoteController.createCreditDebitNote);

router.put("/:id", checkAuth, CreditDebitNoteController.updateCreditDebitNote);

router.delete("/:id", checkAuth, CreditDebitNoteController.deleteCreditDebitNote);

export default router;
