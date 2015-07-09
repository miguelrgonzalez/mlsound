var DBManager = module.exports;

DBManager.initializeUsers = function(callback) {
    this.initializeMultiObjects('security/users', 'users', 'user-name', undefined, callback);
};

DBManager.initializeRoles = function(callback) {
    this.initializeMultiObjects('security/roles', 'roles', 'role-name', undefined, callback);
};

DBManager.removeUsers = function(callback) {
    this.removeMultiObjects('security/users', 'users', 'user-name', undefined, callback);
};

DBManager.removeRoles = function(callback) {
    this.removeMultiObjects('security/roles', 'roles', 'role-name', undefined, callback);
};
