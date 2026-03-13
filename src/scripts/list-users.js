/**
 * List Users Script
 * ──────────────────
 * Usage: node src/scripts/list-users.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { sequelize } = require("../config/database");
const { User, Role } = require("../models");

async function listUsers() {
    try {
        await sequelize.authenticate();

        const users = await User.findAll({
            include: [{ association: "Roles", through: { attributes: [] } }],
            attributes: ["id", "username", "email", "isActive"],
            order: [["id", "ASC"]],
        });

        if (!users.length) {
            console.log("No users found.");
            return;
        }

        console.log("\nUsers in database:");
        console.log("─".repeat(70));
        users.forEach((u) => {
            const roles = u.Roles.map((r) => r.name).join(", ") || "(no roles)";
            console.log(`  ID: ${u.id}  |  ${u.username}  |  Active: ${u.isActive}  |  Roles: [${roles}]`);
        });
        console.log("─".repeat(70));
        console.log("\nTo assign a role run:\n  node src/scripts/assign-role.js <username> <role>\n");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

listUsers();
