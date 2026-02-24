// models/index.js
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Initialize all models (
const User         = require('./User');
const Role         = require('./Role');
const Permission   = require('./Permission');
const Book         = require('./Book');
const Author       = require('./Author');
const Category     = require('./Category');
const Publisher    = require('./Publisher');
const MaterialType = require('./MaterialType');
const Department   = require('./Department');
const Download     = require('./Download');

// ── Junction table models (all timestamps: false — these tables have NO created_at) ──
const UsersRoles = sequelize.define('UsersRoles', {
  user_id: { type: DataTypes.BIGINT, primaryKey: true },
  role_id: { type: DataTypes.BIGINT, primaryKey: true },
}, { tableName: 'users_roles', timestamps: false });

const RolesPermissions = sequelize.define('RolesPermissions', {
  role_id:       { type: DataTypes.BIGINT, primaryKey: true },
  permission_id: { type: DataTypes.BIGINT, primaryKey: true },
}, { tableName: 'roles_permissions', timestamps: false });

const UsersPermissions = sequelize.define('UsersPermissions', {
  user_id:       { type: DataTypes.BIGINT, primaryKey: true },
  permission_id: { type: DataTypes.BIGINT, primaryKey: true },
}, { tableName: 'users_permissions', timestamps: false });

const BookAuthor = sequelize.define('BookAuthor', {
  book_id:   { type: DataTypes.BIGINT, primaryKey: true },
  author_id: { type: DataTypes.BIGINT, primaryKey: true },
  isPrimaryAuthor: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
    field:        'is_primary_author',
  },
}, { tableName: 'books_authors', timestamps: false });

const PublishersBooks = sequelize.define('PublishersBooks', {
  publisher_id: { type: DataTypes.BIGINT, primaryKey: true },
  book_id:      { type: DataTypes.BIGINT, primaryKey: true },
}, { tableName: 'publishers_books', timestamps: false });

// Associations

// RBAC
User.belongsToMany(Role,       { through: UsersRoles,       foreignKey: 'user_id',       otherKey: 'role_id',       as: 'Roles' });
Role.belongsToMany(User,       { through: UsersRoles,       foreignKey: 'role_id',       otherKey: 'user_id',       as: 'Users' });

Role.belongsToMany(Permission, { through: RolesPermissions, foreignKey: 'role_id',       otherKey: 'permission_id', as: 'Permissions' });
Permission.belongsToMany(Role, { through: RolesPermissions, foreignKey: 'permission_id', otherKey: 'role_id',       as: 'Roles' });

User.belongsToMany(Permission, { through: UsersPermissions, foreignKey: 'user_id',       otherKey: 'permission_id', as: 'Permissions' });
Permission.belongsToMany(User, { through: UsersPermissions, foreignKey: 'permission_id', otherKey: 'user_id',       as: 'Users' });

// Book FKs
Book.belongsTo(Category,     { foreignKey: 'category_id',   as: 'Category' });
Book.belongsTo(Publisher,    { foreignKey: 'publisher_id',  as: 'Publisher' });
Book.belongsTo(Department,   { foreignKey: 'department_id', as: 'Department' });
Book.belongsTo(MaterialType, { foreignKey: 'type_id',       as: 'MaterialType' });

Category.hasMany(Book,     { foreignKey: 'category_id',   as: 'Books' });
Publisher.hasMany(Book,    { foreignKey: 'publisher_id',  as: 'Books' });
Department.hasMany(Book,   { foreignKey: 'department_id', as: 'Books' });
MaterialType.hasMany(Book, { foreignKey: 'type_id',       as: 'Books' });

// Book ↔ Author
Book.belongsToMany(Author, { through: BookAuthor,     foreignKey: 'book_id',      otherKey: 'author_id',    as: 'Authors' });
Author.belongsToMany(Book, { through: BookAuthor,     foreignKey: 'author_id',    otherKey: 'book_id',      as: 'Books' });

// Book ↔ Publisher (publishers_books)
Book.belongsToMany(Publisher, { through: PublishersBooks, foreignKey: 'book_id',      otherKey: 'publisher_id', as: 'Publishers' });
Publisher.belongsToMany(Book, { through: PublishersBooks, foreignKey: 'publisher_id', otherKey: 'book_id',      as: 'PublishedBooks' });

// Downloads
Download.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
Download.belongsTo(Book, { foreignKey: 'book_id', as: 'Book' });
User.hasMany(Download,   { foreignKey: 'user_id', as: 'Downloads' });
Book.hasMany(Download,   { foreignKey: 'book_id', as: 'Downloads' });

// ── Exports 
module.exports = {
  sequelize,
  User, Role, Permission,
  Book, Author, Category, Publisher, MaterialType, Department, Download,
  BookAuthor,
};