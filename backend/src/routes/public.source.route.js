import express from "express";
import { securityGuard } from "../middleware/securityGuard.js";
import {
  publicOverviewLimiter,
  publicActionLimiter,
} from "../middleware/rateLimit.js";
import {
  getPublicSourceOverview,
  logPublicAction,
} from "../controllers/public.source.controller.js";

const router = express.Router();

// Apply security penetration guard across all public endpoints
router.use(securityGuard);

// Public isolated overview query - Rate limited per IP
router.get(
  "/source-funds/:referenceId",
  publicOverviewLimiter,
  getPublicSourceOverview,
);

// Public visitor action logging (search, print, share, filter) - Rate limited per IP
router.post(
  "/action-log",
  publicActionLimiter,
  logPublicAction,
);

export default router;
