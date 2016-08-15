var colors = require('colors');
var Promise = require('bluebird');
var dns = Promise.promisifyAll(require('dns'));

var consoleLogger =  {
    prompt : 'mlsound: ',

    debug : function(text) {
        var args = Array.prototype.slice.call(arguments);
        //add first parameter extended
        args[0] = this.prompt.grey + arguments[0];
        console.log.apply(this, args);
    },

    info : function(text) {
        var args = Array.prototype.slice.call(arguments);
        //add first parameter extended
        args[0] = this.prompt.grey + arguments[0];
        console.log.apply(this, args);
    },

    warning : function(text) {
        var args = Array.prototype.slice.call(arguments);
        //add first parameter extended
        args[0] = this.prompt.green + arguments[0];
        console.log.apply(this, args);
    },

    error : function() {
        //argument list to array
        //console log supports printf alike parameters.
        //want to keep that
        var args = Array.prototype.slice.call(arguments);
        //add first parameter extended
        args[0] = this.prompt.red + arguments[0];
        console.log.apply(this, args);
    }

};

var hostname = function(name) {
    //ipv4 and ipv6
    var logger = consoleLogger ;
    var ipRegex = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/;
    //ip
    if (ipRegex.test(name)) {
        logger.info('Reverse lookup on: ' + name);
        return dns.lookupServiceAsync(name, 8001);
    //localhost
    } if (/^localhost$/i.test(name)) {
        logger.info('Reverse lookup on: ' + name);
        return dns.lookupAsync(name)
               .then(function(ip) {
                   //this should be always 127.0.0.1
                   return dns.lookupServiceAsync(ip, 8001);
               });
    //name
    } else {
        return Promise.try(function() { return name.trim() });
    }
};

var getContentType = function(file) {
    var ext = file.split(".");
    ext = ext[ext.length - 1];
    switch(ext) {
        case "sjs":
            return "application/vnd.marklogic-javascript";
            break;
        case "json":
            return "application/json";
            break;
        case "xqy":
            return "application/xquery";
            break;
        case "xsl":
            return "application/xslt+xml";
            break;
        case "xslt":
            return "application/xslt+xml";
            break;
        case "xml":
            return "application/xml";
            break;
        default:
            return "application/vnd.marklogic-javascript";
            break;
    };
};

module.exports = {
    consoleLogger : consoleLogger,
    hostname : hostname,
    getContentType : getContentType
};
