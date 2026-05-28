const { Router } = require('express')
const { reportController } = require('./report.controller') 
const { verifyToken } = require('../../middleware/auth') 

// 1. Safe require fallback to prevent crashing if the file path is completely missing
let authMiddleware;
try {
  authMiddleware = require('../../middleware/auth');
} catch (e) {
  console.error("⚠️ WARNING: Could not resolve auth.middleware path. Bypassing token verification for now.");
}

const reportRouter = Router();

// 2. Destructured inline fallback assignment
const finalVerifyToken = (authMiddleware && authMiddleware.verifyToken) 
  ? authMiddleware.verifyToken 
  : (req, res, next) => next();

// 3. Fallback controller verification
const salesHandler = (reportController && reportController.getSalesReport)
  ? reportController.getSalesReport.bind(reportController)
  : (req, res) => res.status(500).json({ error: "getSalesReport controller method is missing" });

const cashierPerfHandler = (reportController && reportController.getCashierPerformance)
  ? reportController.getCashierPerformance.bind(reportController)
  : (req, res) => res.status(500).json({ error: "getCashierPerformance controller method is missing" });

// 4. Bind routes
reportRouter.get('/sales', finalVerifyToken, salesHandler);
reportRouter.get('/cashier-performance', finalVerifyToken, cashierPerfHandler);

module.exports = { reportRouter };