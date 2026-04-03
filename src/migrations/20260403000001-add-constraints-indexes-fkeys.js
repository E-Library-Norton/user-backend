'use strict';

/**
 * Migration: Add missing UNIQUE constraints, indexes, and foreign keys
 * to the existing E-Library database.
 *
 * This is a "catch-up" migration — the tables already exist (created by
 * sequelize.sync), so we only ALTER them to add what's missing.
 *
 * Covers:
 *  ✅ UNIQUE on authors.name, editors.name, publishers.name, material_types.name
 *  ✅ Indexes on lookup/junction tables for reverse queries
 *  ✅ Foreign keys with ON DELETE CASCADE / SET NULL
 *  ✅ Composite unique on reviews (book_id, user_id) — one review per user per book
 *  ✅ Performance indexes on commonly queried columns
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ────────────────────────────────────────────────────────────────────────
    // Helper: add index only if it doesn't already exist
    // ────────────────────────────────────────────────────────────────────────
    async function safeAddIndex(table, columns, options = {}) {
      try {
        await queryInterface.addIndex(table, columns, options);
      } catch (err) {
        // 42P07 = relation already exists (Postgres)
        if (err.original?.code === '42P07' || err.message?.includes('already exists')) {
          console.log(`  ⏭  Index already exists: ${table}(${columns}) — skipping`);
        } else {
          throw err;
        }
      }
    }

    async function safeAddConstraint(table, name, options) {
      try {
        await queryInterface.addConstraint(table, { name, ...options });
      } catch (err) {
        if (err.original?.code === '42710' || err.message?.includes('already exists')) {
          console.log(`  ⏭  Constraint already exists: ${name} — skipping`);
        } else {
          throw err;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. UNIQUE CONSTRAINTS on name columns
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n📌 Adding UNIQUE constraints...');

    await safeAddIndex('authors', ['name'], {
      unique: true,
      name: 'authors_name_unique',
    });

    await safeAddIndex('editors', ['name'], {
      unique: true,
      name: 'editors_name_unique',
    });

    await safeAddIndex('publishers', ['name'], {
      unique: true,
      name: 'publishers_name_unique',
    });

    await safeAddIndex('material_types', ['name'], {
      unique: true,
      name: 'material_types_name_unique',
    });

    await safeAddIndex('departments', ['name'], {
      unique: true,
      name: 'departments_name_unique',
    });

    // One review per user per book (only non-deleted)
    await safeAddIndex('reviews', ['book_id', 'user_id'], {
      unique: true,
      name: 'reviews_book_user_unique',
      where: { is_deleted: false },
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. PERFORMANCE INDEXES
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n📌 Adding performance indexes...');

    // -- users --
    await safeAddIndex('users', ['is_deleted'], { name: 'users_is_deleted' });
    await safeAddIndex('users', ['created_at'], { name: 'users_created_at' });

    // -- authors / editors / publishers (name lookup) --
    await safeAddIndex('authors', ['name'], { name: 'authors_name_idx' });
    await safeAddIndex('editors', ['name'], { name: 'editors_name_idx' });
    await safeAddIndex('publishers', ['name'], { name: 'publishers_name_idx' });

    // -- books (extra) --
    await safeAddIndex('books', ['downloads'], { name: 'books_downloads' });
    await safeAddIndex('books', ['language'], { name: 'books_language' });

    // -- downloads (composite for "has user downloaded?") --
    await safeAddIndex('downloads', ['user_id', 'book_id'], {
      name: 'downloads_user_book',
    });

    // -- activities (composite for entity lookup) --
    await safeAddIndex('activities', ['target_type', 'target_id'], {
      name: 'activities_target_type_id',
    });

    // -- push_subscriptions --
    await safeAddIndex('push_subscriptions', ['user_id'], {
      name: 'push_subscriptions_user_id',
    });

    // -- settings --
    await safeAddIndex('settings', ['group'], { name: 'settings_group' });

    // ═══════════════════════════════════════════════════════════════════════
    // 3. JUNCTION TABLE REVERSE-KEY INDEXES
    //    (composite PKs only auto-index the first column)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n📌 Adding junction table reverse-key indexes...');

    await safeAddIndex('books_authors', ['author_id'], {
      name: 'books_authors_author_id',
    });
    await safeAddIndex('books_editors', ['editor_id'], {
      name: 'books_editors_editor_id',
    });
    await safeAddIndex('publishers_books', ['publisher_id'], {
      name: 'publishers_books_publisher_id',
    });
    await safeAddIndex('users_roles', ['role_id'], {
      name: 'users_roles_role_id',
    });
    await safeAddIndex('roles_permissions', ['permission_id'], {
      name: 'roles_permissions_permission_id',
    });
    await safeAddIndex('users_permissions', ['permission_id'], {
      name: 'users_permissions_permission_id',
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. FOREIGN KEY CONSTRAINTS with ON DELETE / ON UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n📌 Adding foreign key constraints...');

    // -- books FKs --
    await safeAddConstraint('books', 'fk_books_category', {
      type: 'foreign key',
      fields: ['category_id'],
      references: { table: 'categories', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('books', 'fk_books_publisher', {
      type: 'foreign key',
      fields: ['publisher_id'],
      references: { table: 'publishers', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('books', 'fk_books_department', {
      type: 'foreign key',
      fields: ['department_id'],
      references: { table: 'departments', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('books', 'fk_books_type', {
      type: 'foreign key',
      fields: ['type_id'],
      references: { table: 'material_types', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // -- books_authors FKs --
    await safeAddConstraint('books_authors', 'fk_ba_book', {
      type: 'foreign key',
      fields: ['book_id'],
      references: { table: 'books', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('books_authors', 'fk_ba_author', {
      type: 'foreign key',
      fields: ['author_id'],
      references: { table: 'authors', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- books_editors FKs --
    await safeAddConstraint('books_editors', 'fk_be_book', {
      type: 'foreign key',
      fields: ['book_id'],
      references: { table: 'books', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('books_editors', 'fk_be_editor', {
      type: 'foreign key',
      fields: ['editor_id'],
      references: { table: 'editors', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- publishers_books FKs --
    await safeAddConstraint('publishers_books', 'fk_pb_book', {
      type: 'foreign key',
      fields: ['book_id'],
      references: { table: 'books', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('publishers_books', 'fk_pb_publisher', {
      type: 'foreign key',
      fields: ['publisher_id'],
      references: { table: 'publishers', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- users_roles FKs --
    await safeAddConstraint('users_roles', 'fk_ur_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('users_roles', 'fk_ur_role', {
      type: 'foreign key',
      fields: ['role_id'],
      references: { table: 'roles', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- roles_permissions FKs --
    await safeAddConstraint('roles_permissions', 'fk_rp_role', {
      type: 'foreign key',
      fields: ['role_id'],
      references: { table: 'roles', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('roles_permissions', 'fk_rp_permission', {
      type: 'foreign key',
      fields: ['permission_id'],
      references: { table: 'permissions', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- users_permissions FKs --
    await safeAddConstraint('users_permissions', 'fk_up_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('users_permissions', 'fk_up_permission', {
      type: 'foreign key',
      fields: ['permission_id'],
      references: { table: 'permissions', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- downloads FKs --
    await safeAddConstraint('downloads', 'fk_downloads_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('downloads', 'fk_downloads_book', {
      type: 'foreign key',
      fields: ['book_id'],
      references: { table: 'books', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- reviews FKs --
    await safeAddConstraint('reviews', 'fk_reviews_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await safeAddConstraint('reviews', 'fk_reviews_book', {
      type: 'foreign key',
      fields: ['book_id'],
      references: { table: 'books', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // -- activities FK --
    await safeAddConstraint('activities', 'fk_activities_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // -- push_subscriptions FK --
    await safeAddConstraint('push_subscriptions', 'fk_pushsub_user', {
      type: 'foreign key',
      fields: ['user_id'],
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 5. CHECK CONSTRAINT — rating between 1 and 5
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n📌 Adding CHECK constraint on reviews.rating...');
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5);`
      );
    } catch (err) {
      if (err.original?.code === '42710' || err.message?.includes('already exists')) {
        console.log('  ⏭  CHECK constraint already exists — skipping');
      } else {
        throw err;
      }
    }

    console.log('\n✅ Migration complete!\n');
  },

  async down(queryInterface, Sequelize) {
    // ── Remove CHECK constraint ─────────────────────────────────────────
    await queryInterface.sequelize.query(
      `ALTER TABLE reviews DROP CONSTRAINT IF EXISTS chk_reviews_rating;`
    ).catch(() => {});

    // ── Remove foreign keys ─────────────────────────────────────────────
    const fks = [
      ['push_subscriptions', 'fk_pushsub_user'],
      ['activities', 'fk_activities_user'],
      ['reviews', 'fk_reviews_book'],
      ['reviews', 'fk_reviews_user'],
      ['downloads', 'fk_downloads_book'],
      ['downloads', 'fk_downloads_user'],
      ['users_permissions', 'fk_up_permission'],
      ['users_permissions', 'fk_up_user'],
      ['roles_permissions', 'fk_rp_permission'],
      ['roles_permissions', 'fk_rp_role'],
      ['users_roles', 'fk_ur_role'],
      ['users_roles', 'fk_ur_user'],
      ['publishers_books', 'fk_pb_publisher'],
      ['publishers_books', 'fk_pb_book'],
      ['books_editors', 'fk_be_editor'],
      ['books_editors', 'fk_be_book'],
      ['books_authors', 'fk_ba_author'],
      ['books_authors', 'fk_ba_book'],
      ['books', 'fk_books_type'],
      ['books', 'fk_books_department'],
      ['books', 'fk_books_publisher'],
      ['books', 'fk_books_category'],
    ];
    for (const [table, name] of fks) {
      await queryInterface.removeConstraint(table, name).catch(() => {});
    }

    // ── Remove indexes ──────────────────────────────────────────────────
    const indexes = [
      ['users_permissions', 'users_permissions_permission_id'],
      ['roles_permissions', 'roles_permissions_permission_id'],
      ['users_roles', 'users_roles_role_id'],
      ['publishers_books', 'publishers_books_publisher_id'],
      ['books_editors', 'books_editors_editor_id'],
      ['books_authors', 'books_authors_author_id'],
      ['settings', 'settings_group'],
      ['push_subscriptions', 'push_subscriptions_user_id'],
      ['activities', 'activities_target_type_id'],
      ['downloads', 'downloads_user_book'],
      ['books', 'books_language'],
      ['books', 'books_downloads'],
      ['publishers', 'publishers_name_idx'],
      ['editors', 'editors_name_idx'],
      ['authors', 'authors_name_idx'],
      ['users', 'users_created_at'],
      ['users', 'users_is_deleted'],
    ];
    for (const [table, name] of indexes) {
      await queryInterface.removeIndex(table, name).catch(() => {});
    }

    // ── Remove unique constraints ───────────────────────────────────────
    const uniques = [
      ['reviews', 'reviews_book_user_unique'],
      ['departments', 'departments_name_unique'],
      ['material_types', 'material_types_name_unique'],
      ['publishers', 'publishers_name_unique'],
      ['editors', 'editors_name_unique'],
      ['authors', 'authors_name_unique'],
    ];
    for (const [table, name] of uniques) {
      await queryInterface.removeIndex(table, name).catch(() => {});
    }
  },
};
