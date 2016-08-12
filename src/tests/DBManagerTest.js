var should = require('should');
var database = require('../lib/database.js');

describe("DBManager", function() {

    it("Database Client is available", function() {
        var dbManager = database.createDBManager('local');
        var databaseClient = dbManager.getDatabaseClient();
        should.exist(databaseClient);
    });

    it("Http Manager is available", function(done) {
        var dbManager = database.createDBManager('local');
        var httpManager = dbManager.getHttpManager();
        should.exist(httpManager);
        done();
    });

});
