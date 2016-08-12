before(function(done) {
    process.chdir('src/tests');
    done();
});

after(function (done) {
    process.chdir('../..');
    done();
});
