/**
 * Assign Role to User Script
 * ───────────────────────────
 * Usage:
 *   node src/scripts/assign-role.js <username> <role>
 *
 * Examples:
 *   node src/scripts/assign-role.js john admin
 *   node src/scripts/assign-role.js john librarian
 *   node src/scripts/assign-role.js john student
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { sequelize } = require("../config/database");
const { User, Role } = require("../models");

async function assignRole() {
    const [, , username, roleName] = process.argv;

    if (!username || !roleName) {
        console.error("❌ Usage: node src/scripts/assign-role.js <username> <role>");
        console.error("   Example: node src/scripts/assign-role.js john admin");
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        console.log("✅ Database connected.\n");

        // Find user
        const user = await User.findOne({ where: { username }, include: [{ association: "Roles" }] });
        if (!user) {
            console.error(`❌ User not found: ${username}`);
            process.exit(1);
        }

        // Find role
        const role = await Role.findOne({ where: { name: roleName } });
        if (!role) {
            console.error(`❌ Role not found: "${roleName}"`);
            console.error("   Run seed-roles.js first to create default roles.");
            process.exit(1);
        }

        // Assign
        await user.addRole(role);

        // Reload and show current roles
        const updated = await User.findByPk(user.id, { include: [{ association: "Roles" }] });
        const roles = updated.Roles.map(r => r.name).join(", ");

        console.log(`✅ Role '${roleName}' assigned to user '${username}'.`);
        console.log(`   Current roles: [${roles}]\n`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err.message || err);
        process.exit(1);
    }
}

assignRole();
