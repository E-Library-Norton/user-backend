// models/index.js
const  {sequelize}  = require('../config/database');

// ── Import all models 
const User = require('./User')
const Role = require('./Role')
const Permission = require('./Permission')
const Book = require('./Book')
const Author = require('./Author')
const Category = require('./Category')
const Publisher = require('./Publisher')
const MaterialType = require('./MaterialType')
const Department = require('./Department')
const Download = require('./Download')

// ── RBAC associations 
User.belongsToMany(Role, { through: 'users_roles', foreignKey: 'user_id', otherKey: 'role_id', as: 'Roles' });
Role.belongsToMany(User, { through: 'users_roles', foreignKey: 'role_id', otherKey: 'user_id', as: 'Users' });

Role.belongsToMany(Permission, { through: 'roles_permissions', foreignKey: 'role_id', otherKey: 'permission_id', as: 'Permissions' });
Permission.belongsToMany(Role, { through: 'roles_permissions', foreignKey: 'permission_id', otherKey: 'role_id', as: 'Roles' });

User.belongsToMany(Permission, { through: 'users_permissions', foreignKey: 'user_id', otherKey: 'permission_id', as: 'Permissions' });
Permission.belongsToMany(User, { through: 'users_permissions', foreignKey: 'permission_id', otherKey: 'user_id', as: 'Users' });

// ── Book associations 
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'Category' });
Book.belongsTo(Publisher, { foreignKey: 'publisher_id', as: 'Publisher' });
Book.belongsTo(Department, { foreignKey: 'department_id', as: 'Department' });
Book.belongsTo(MaterialType, { foreignKey: 'type_id', as: 'MaterialType' });

Category.hasMany(Book, { foreignKey: 'category_id', as: 'Books' });
Publisher.hasMany(Book, { foreignKey: 'publisher_id', as: 'Books' });
Department.hasMany(Book, { foreignKey: 'department_id', as: 'Books' });
MaterialType.hasMany(Book, { foreignKey: 'type_id', as: 'Books' });

// ── Book ↔ Author (many-to-many) 
Book.belongsToMany(Author, {
  through: 'books_authors',
  foreignKey: 'book_id',
  otherKey: 'author_id',
  as: 'Authors',
});
Author.belongsToMany(Book, {
  through: 'books_authors',
  foreignKey: 'author_id',
  otherKey: 'book_id',
  as: 'Books',
});

// ── Book ↔ Publisher (extra junction — publishers_books) 
Book.belongsToMany(Publisher, {
  through: 'publishers_books',
  foreignKey: 'book_id',
  otherKey: 'publisher_id',
  as: 'Publishers',
});
Publisher.belongsToMany(Book, {
  through: 'publishers_books',
  foreignKey: 'publisher_id',
  otherKey: 'book_id',
  as: 'PublishedBooks',
});

// ── Downloads 
Download.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
Download.belongsTo(Book, { foreignKey: 'book_id', as: 'Book' });
User.hasMany(Download, { foreignKey: 'user_id', as: 'Downloads' });
Book.hasMany(Download, { foreignKey: 'book_id', as: 'Downloads' });

module.exports = {
  sequelize,
  User, Role, Permission,
  Book, Author, Category, Publisher, MaterialType, Department, Download,
};