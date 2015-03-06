'use strict';
var del = require('del');
var gulp = require('gulp');
var path = require('path');



var statici18n = require('../../../index');

gulp.task('clean', function(done) {
  del(['build'], { cwd: __dirname, force: true }, done);
});

gulp.task('build', ['clean'], function(){
  return gulp.src(['src/**'], { cwd: __dirname, base: path.join(__dirname, 'src') })
    .pipe(gulp.dest('build', { cwd: __dirname }));
});
var localePath = path.join(__dirname, 'locale');
var nestedMsgPath = path.join(__dirname, 'installed_deps/locale');
var options = {
  localeDir: localePath,
  msgDirs: [localePath, nestedMsgPath]
};

gulp.task('translate', ['build'], function(){
  return gulp.src(['build'], { cwd: __dirname })
    .pipe(statici18n(options));
});

gulp.task('default', ['translate']);

module.exports = gulp;
