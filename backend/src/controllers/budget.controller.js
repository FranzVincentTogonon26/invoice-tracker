import Budget from "../models/budget.model.js";
import { validate } from "../utils/validate.js";
import { budgetSchema } from "../validations/budget.validation.js";

export const createBudget = async (req, res, next) => {
  try {
    const { description, amount, method } = validate(budgetSchema, req.body);

    // zod guarantees `amount` is a positive number; normalize just in case
    const parsedAmount = Number(amount);

    // user_id comes from the verified JWT (req.user), never from the client
    const newBudget = await Budget.createBudget({
      user_id: req.user.id,
      amount: parsedAmount,
      description: String(description).trim(),
      method,
      approved_by: req.user.name,
    });

    res.status(201).json({ budget: newBudget });
  } catch (err) {
    next(err);
  }
};
