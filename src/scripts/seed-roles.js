/**
 * Seed Roles & Assign Admin Script
 * ─────────────────────────────────
 * Usage:
 *   node src/scripts/seed-roles.js
 *
 * What it does:
 *  1. Creates all default roles (admin, librarian, student, member, etc.)
 *  2. Creates all default permissions
 *  3. Assigns all permissions to the admin role
 *  4. Assigns the admin role to the FIRST user (user_id = 1) — change as needed
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { sequelize } = require("../config/database");
const { Role, Permission, User } = require("../models");

// ── Default Roles ───────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
    { name: "admin", description: "Full system access" },
    { name: "administrator", description: "System administrator" },
    { name: "super admin", description: "Super administrator" },
    { name: "librarian", description: "Manages books and resources" },
    { name: "student", description: "Regular student user" },
    { name: "member", description: "General library member" },
    { name: "testing", description: "Testing role" },
];

// ── Default Permissions ─────────────────────────────────────────────────────
const DEFAULT_PERMISSIONS = [
    { name: "view_users", description: "Can view users" },
    { name: "create_users", description: "Can create users" },
    { name: "update_users", description: "Can update users" },
    { name: "delete_users", description: "Can delete users" },
    { name: "view_books", description: "Can view books" },
    { name: "create_books", description: "Can create books" },
    { name: "update_books", description: "Can update books" },
    { name: "delete_books", description: "Can delete books" },
    { name: "view_stats", description: "Can view statistics" },
    { name: "manage_roles", description: "Can manage roles" },
    { name: "manage_settings", "description": "Can manage settings" },
];

// ── CONFIGURATION ────────────────────────────────────────────────────────────
// Set this to the username or user ID you want to grant admin access to.
// Leave USER_IDENTIFIER as null to skip user role assignment.
const USER_IDENTIFIER = null; // e.g., 'admin' or 'your_username'

async function seed() {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connected.");

        // 1. Create default roles
        console.log("\n📚 Seeding roles...");
        const createdRoles = {};
        for (const roleData of DEFAULT_ROLES) {
            const [role, created] = await Role.findOrCreate({
                where: { name: roleData.name },
                defaults: roleData,
            });
            createdRoles[role.name] = role;
            console.log(`  ${created ? "✅ Created" : "⏭️  Exists"}: ${role.name}`);
        }

        // 2. Create default permissions
        console.log("\n🔑 Seeding permissions...");
        const createdPermissions = [];
        for (const permData of DEFAULT_PERMISSIONS) {
            const [perm, created] = await Permission.findOrCreate({
                where: { name: permData.name },
                defaults: permData,
            });
            createdPermissions.push(perm);
            console.log(`  ${created ? "✅ Created" : "⏭️  Exists"}: ${perm.name}`);
        }

        // 3. Assign all permissions to admin role
        console.log("\n🛡️  Assigning all permissions to admin role...");
        const adminRole = createdRoles["admin"];
        if (adminRole) {
            await adminRole.setPermissions(createdPermissions);
            console.log(`  ✅ ${createdPermissions.length} permissions assigned to 'admin'.`);
        }

        // 4. Optionally assign admin role to a user
        if (USER_IDENTIFIER) {
            console.log(`\n👤 Assigning admin role to user: "${USER_IDENTIFIER}"...`);
            const isNumeric = !isNaN(USER_IDENTIFIER);
            const user = isNumeric
                ? await User.findByPk(USER_IDENTIFIER)
                : await User.findOne({ where: { username: USER_IDENTIFIER } });

            if (!user) {
                console.warn(`  ⚠️  User not found: ${USER_IDENTIFIER}`);
            } else {
                await user.addRole(adminRole);
                console.log(`  ✅ Admin role assigned to '${user.username}'.`);
            }
        } else {
            console.log("\nℹ️  Skipping user role assignment (USER_IDENTIFIER is null).");
            console.log("   To assign admin to a user, run the assign-role script instead.");
        }

        console.log("\n🎉 Done!\n");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed error:", err.message || err);
        process.exit(1);
    }
}

seed();
