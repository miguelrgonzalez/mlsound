var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.initializeUsers = function(callback) {
    this.initializeMultiObjects('security/users', 'users', 'user-name', undefined, callback);
};

DBManager.initializeRoles = function(callback) {
    this.initializeMultiObjects('security/roles', 'roles', 'role-name', undefined, callback);
};
