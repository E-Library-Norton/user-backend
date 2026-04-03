// src/controllers/settingController.js
const { Setting } = require("../models");
const ResponseFormatter = require("../utils/responseFormatter");

class SettingController {
    // ── GET /api/settings
    static async getAll(req, res, next) {
        try {
            const settingsRows = await Setting.findAll();
            const settings = {};

            settingsRows.forEach(row => {
                let value = row.value;
                if (row.type === "json" && value) {
                    try { value = JSON.parse(value); } catch (e) { console.error("Parse error for key", row.key); }
                } else if (row.type === "boolean") {
                    value = value === "true";
                } else if (row.type === "number") {
                    value = Number(value);
                }
                settings[row.key] = value;
            });

            return ResponseFormatter.success(res, settings);
        } catch (err) {
            next(err);
        }
    }

    // ── POST /api/settings
    static async updateBatch(req, res, next) {
        try {
            const settingsData = req.body; // Expecting { key: value, ... }
            const keys = Object.keys(settingsData);

            const records = keys.map(key => {
                let value = settingsData[key];
                let type = "string";

                if (typeof value === "object" && value !== null) {
                    value = JSON.stringify(value);
                    type = "json";
                } else if (typeof value === "boolean") {
                    value = value ? "true" : "false";
                    type = "boolean";
                } else if (typeof value === "number") {
                    value = String(value);
                    type = "number";
                }

                return { key, value, type, group: req.query.group || "general" };
            });

            await Setting.bulkCreate(records, {
                updateOnDuplicate: ['value', 'type', 'group', 'updated_at'],
            });

            return ResponseFormatter.success(res, null, "Settings updated successfully");
        } catch (err) {
            next(err);
        }
    }
}

module.exports = SettingController;
