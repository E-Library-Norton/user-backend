const { Setting } = require("./src/models");
const { sequelize } = require("./src/config/database");

async function debugSettings() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB");
        const settings = await Setting.findAll();
        if (settings.length === 0) {
            console.log("Seeding default settings...");
            await Setting.bulkCreate([
                { key: "library_name", value: "University E-Library", type: "string", group: "general" },
                { key: "library_email", value: "library@university.edu", type: "string", group: "general" },
                { key: "library_address", value: "123 University Road, Phnom Penh, Cambodia", type: "string", group: "general" },
                { key: "library_phone", value: "+855 23 123 456", type: "string", group: "general" },
                { key: "library_website", value: "https://library.university.edu", type: "string", group: "general" },
                { key: "notify_new_uploads", value: "true", type: "boolean", group: "notifications" },
                { key: "notify_registrations", value: "true", type: "boolean", group: "notifications" },
                { key: "notify_weekly_reports", value: "false", type: "boolean", group: "notifications" },
                { key: "notify_email", value: "true", type: "boolean", group: "notifications" },
                { key: "two_factor_auth", value: "false", type: "boolean", group: "security" },
                { key: "session_timeout", value: "30", type: "number", group: "security" }
            ]);
            console.log("Seeding complete!");
        }
        const updated = await Setting.findAll();
        console.log("Current Settings in DB:");
        console.log(JSON.stringify(updated, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugSettings();
