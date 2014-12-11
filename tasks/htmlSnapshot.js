/*
 * grunt-html-snapshot
 *
 * Copyright (c) 2013 Christoph Burgdorf, contributors
 * Licensed under the MIT license.
 */
(function() {

'use strict';

module.exports = function(grunt) {

    var fs          = require("fs"),
        path        = require("path"),
        phantom     = require("grunt-lib-phantomjs").init(grunt);

    var asset = path.join.bind(null, __dirname, '..');

    var videos = {};

    grunt.registerMultiTask('crawler','fetch html snapshots', function(){

        var options = this.options({
          urls: [],
          msWaitForPages: 500,
          fileNamePrefix: 'snapshot_',
          sanitize: function(requestUri) {
            return requestUri.replace(/#|\/|\!/g, '_');
          },
          snapshotPath: '',
          sitePath: '',
          replaceStrings: [],
          haltOnError: true
        });

        // the channel prefix for this async grunt task
        var taskChannelPrefix = "" + new Date().getTime();

        var sanitizeFilename = options.sanitize;

        var isLastUrl = function(url){
            return options.urls[options.urls.length - 1] === url;
        };

        grunt.log.writeln('DEBUG - Setup');

        phantom.on(taskChannelPrefix + ".error.onError", function (msg, trace) {
            if (options.haltOnError) {
                phantom.halt();
                grunt.warn('error: ' + msg, 6);
            } else {
                grunt.log.writeln(msg);
            }
        });

        phantom.on(taskChannelPrefix + ".console", function (msg, trace) {
            grunt.log.writeln(msg);
        });

        phantom.on(taskChannelPrefix + ".htmlSnapshot.pageReady", function (msg, url) {
            var plainUrl = url.replace(sitePath, '');

            var fileName =  options.snapshotPath +
                            options.fileNamePrefix +
                            sanitizeFilename(plainUrl) +
                            '.html';

            // var videoId, thumbnail, video;

            if(plainUrl === '/' || plainUrl.indexOf('section') !== -1){
                //We're not looking for video code, but we are adding a ton of urls to the array
                //and saving thumbnails to the videos array


                videoId = parseInt(plainUrl.replace('/', ''));
                thumbnail = '';
                videos[videoId] = {sourceId: videoId, thumbnail: thumbnail};
            }else{
                videoId = parseInt(plainUrl.replace('/', ''));
                //We're on a video page and adding all the rest of the info the videos array
                if(!videos[videoId]){ //############################
                    //Houston, we have a problem
                }

                video = videos[videoId];

                // video.country = country;
            }

            grunt.file.write(fileName, msg);
            grunt.log.writeln(fileName, 'written');
            phantom.halt();


            var hrefs = msg.split('href="');

            for(var i = 1; i < hrefs.length; i++){
                var url = hrefs[i].substring(0, hrefs[i].indexOf('"'));

                //Make sure the URL is a local one, and that the url is not actually a link to a file (e.g. in meta tags)
                if(url.indexOf('/') === 0 && !(/\..*/.test(url)) && options.urls.indexOf(url) === -1){
                    // grunt.log.writeln('Would have added this URL to the list: ' + url);
                    // options.urls.push(url);
                }
            }

            isLastUrl(plainUrl) && done();
        });

        var done = this.async();

        var urls = options.urls;
        var sitePath = options.sitePath;

        grunt.util.async.forEachSeries(urls, function(url, next) {
            grunt.log.writeln('DEBUG - Spawning new process');

            phantom.spawn(sitePath + url, {
                // Additional PhantomJS options.
                options: {
                    phantomScript: asset('phantomjs/bridge.js'),
                    msWaitForPages: options.msWaitForPages,
                    bodyAttr: options.bodyAttr,
                    cookies: options.cookies,
                    taskChannelPrefix: taskChannelPrefix
                },
                // Complete the task when done.
                done: function (err) {
                    grunt.log.writeln('DEBUG - Done with this process, moving onto next one.');
                    if (err) {
                        // If there was an error, abort the series.
                        done();
                    }
                    else {
                        // Otherwise, process next url.
                        next();
                    }
                }
            });
        });
        grunt.log.writeln('running html-snapshot task...hold your horses');
    });
};

}());
