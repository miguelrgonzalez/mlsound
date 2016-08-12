var should = require('should');
var common = require('../lib/common.js');

describe("Common", function() {

    it("Configuration for default group found", function() {
        var settings = common.objectSettings('groups/default', 'local');
        should.exist(settings);
        settings["group-name"].should.equal("Default");
    });

    it("Configuration for content database found", function() {
        var settings = common.objectSettings('databases/content', 'local');
        should.exist(settings);
        settings["database-name"].should.equal("database-name");
        settings["schema-database"].should.equal("Schemas");
        settings["triggers-database"].should.equal("Triggers");
        settings["triple-index"].should.equal("false");
    });

});
