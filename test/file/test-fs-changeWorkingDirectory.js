var assert = require("assert");
var fs = require('fs');

const SEPARATOR = require("ringo/utils/files").separator;

exports.testChangeWorkingDirectory = function () {
    var currentWorkingDirectory = java.lang.System.getProperty("user.dir") + SEPARATOR;
    var tempWorkingDirectory = java.nio.file.Files.createTempDirectory("ringo-wkdir-test") + SEPARATOR;

    // change the working directory
    assert.equal(fs.workingDirectory(), currentWorkingDirectory);
    fs.changeWorkingDirectory(tempWorkingDirectory);
    assert.equal(fs.workingDirectory(), tempWorkingDirectory);

    // switch back
    fs.changeWorkingDirectory(currentWorkingDirectory);
    assert.equal(fs.workingDirectory(), currentWorkingDirectory);

    // clean up
    fs.removeTree(tempWorkingDirectory);
    assert.isFalse(fs.exists(tempWorkingDirectory));
};

if (require.main == module.id) {
    require('system').exit(require("test").run(module.id));
}