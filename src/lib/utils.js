var colors = require('colors');

var consoleLogger =  {
    prompt : 'mlsound: ',

    debug : function(text) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(this, [this.prompt.grey + arguments[0], args.shift()]);
    },

    info : function(text) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(this, [this.prompt.grey + arguments[0], args.shift()]);
    },

    warning : function(text) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(this, [this.prompt.green + arguments[0], args.shift()]);
    },

    error : function() {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(this, [this.prompt.red + arguments[0], args.shift()]);
    }

};

module.exports = {
    consoleLogger : consoleLogger
};
