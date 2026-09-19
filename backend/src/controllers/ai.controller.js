import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import * as Service from "../services/geminiService.js";

export const extractReceipt = async (req, res, next) => {
  try {
    const data = await Service.generateReceipt({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
};
