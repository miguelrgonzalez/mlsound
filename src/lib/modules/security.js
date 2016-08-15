var Promise = require('bluebird');
var DBManager = module.exports;

DBManager.initializeUsers = function() {
    var that = this;
    return new Promise(function(resolve, reject){
        that.initializeMultiObjects('security/users', 'users', 'user-name', undefined, undefined).then(function(msg){resolve(msg);});
    });
};

DBManager.initializeRoles = function() {
    var that = this;
    return new Promise(function(resolve, reject){
        that.initializeMultiObjects('security/roles', 'roles', 'role-name', undefined, undefined).then(function(msg){resolve(msg);});
    });
};

DBManager.removeUsers = function() {
    var that = this;
    return new Promise(function(resolve, reject){
        that.removeMultiObjects('security/users', 'users', 'user-name', undefined)
        .done(function(msg){resolve(msg);});
    });
};

DBManager.removeRoles = function() {
    var that = this;
    return new Promise(function(resolve, reject){
        that.removeMultiObjects('security/roles', 'roles', 'role-name', undefined)
        .done(function(msg){resolve(msg);});;
    });
};
