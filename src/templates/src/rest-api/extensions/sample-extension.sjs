var process = function (context, params, input) {
    context.outputTypes = ["application/json"];
    context.outputStatus = [200, "OK"];
    return {"hello" : "world"};
};

exports.PUT = process;
exports.POST = process;
