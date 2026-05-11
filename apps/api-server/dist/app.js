"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./routes");
const notFound_1 = require("./middleware/notFound");
const errorHandler_1 = require("./middleware/errorHandler");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: "1mb" }));
    app.get("/", (_req, res) => {
        res.json({
            message: "API running successfully",
        });
    });
    app.use((req, res) => {
        res.status(404).json({
            error: "Not Found",
            path: req.originalUrl,
        });
    });
    app.use("/api", routes_1.apiRouter);
    app.use(notFound_1.notFound);
    app.use(errorHandler_1.errorHandler);
    return app;
}
