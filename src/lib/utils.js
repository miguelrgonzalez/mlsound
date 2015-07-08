var colors = require('colors');

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

module.exports = {
    consoleLogger : consoleLogger
};
