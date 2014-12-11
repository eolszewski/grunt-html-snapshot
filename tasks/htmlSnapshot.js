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

    var videos = {}, pagesVisited = 0, regularExpressions = {
        title: /<h1>([\s\S]*?)<\/h1>/g,
        sourceUrl: /<a href="(http:\/\/video\.mystreamservice\.com[\s\S]*?\.mp4)/g,
        description: /<td class="synopsis more"[\s\S]*?>([\s\S]*?)<\/td>/g,
        cast: /<th>Cast<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g,
        tags: /<th>Tags<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g,
        duration: /<th>Runtime<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g,
        country: /<th>Country<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g,
        language: /<th>Language<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g,
        sourceCreatedDate: /<th>Published<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/g
    };

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
                // phantom.halt();
                // grunt.warn('error: ' + msg, 6);
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


            if(pagesVisited === 0){
                //Since this is the first page, we're going to add all the other index pages
                for(var i = 1; i <= 2; i++){
                    // options.urls.push('/section/home/' + i);
                }
            }


            var matches = [], regexp = /data-original="([\s\S]*?)"/g, match, videoId, thumbnail, video;

            msg = msg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            msg = msg.replace(/<style\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/style>/gi, '');
            msg = msg.replace(/<link\s.*?(\/)?>/gi, '');
            msg = msg.replace(/<meta\s.*?(\/)?>/gi, '');

            if(plainUrl === '/' || plainUrl.indexOf('section') !== -1){
                //We're not looking for video code, but we are adding a ton of urls to the array
                //and saving thumbnails to the videos array

                console.log('We are looking at an index page');
                
                while ((match = regexp.exec(msg)) != null) {
                    if(typeof match === 'undefined'){
                        console.log('match was undefined');
                        continue;
                    }

                    if(match.indexOf('tag') !== -1){
                        continue;
                    }

                    videoId = parseInt(match[1].substring(32));
                    thumbnail = match[1];
                    
                    if(!videos[videoId]){
                        videos[videoId] = {sourceId: videoId, thumbnail: thumbnail};
                    }

                    if(options.urls.indexOf('/' + videoId) === -1){
                        options.urls.push('/' + videoId);
                    }
                }
            }else{
                videoId = parseInt(plainUrl.replace('/', ''));
                video = videos[videoId];
                console.log('Video page');

                match = regularExpressions.title.exec(msg);
                video.title = (match != null) ? match[1] : '';

                match = regularExpressions.sourceUrl.exec(msg)[1] || '';
                video.sourceUrl = (match != null) ? match[1] : '';
                
                match = regularExpressions.description.exec(msg)[1] || '';
                video.description = (match != null) ? match[1] : '';
                
                match = regularExpressions.cast.exec(msg)[1] || '';
                video.cast = (match != null) ? match[1] : '';
                
                match = regularExpressions.tags.exec(msg)[1] || '';
                video.tags = (match != null) ? match[1] : '';
                
                match = regularExpressions.duration.exec(msg)[1] || '';
                video.duration = (match != null) ? match[1] : '';
                
                match = regularExpressions.country.exec(msg)[1] || '';
                video.country = (match != null) ? match[1] : '';
                
                match = regularExpressions.language.exec(msg)[1] || '';
                video.language = (match != null) ? match[1] : '';
                
                match = regularExpressions.sourceCreatedDate.exec(msg)[1] || '';
                video.sourceCreatedDate = (match != null) ? match[1] : '';
                
            }

            // grunt.file.write(fileName, msg);
            // grunt.log.writeln(fileName, 'written');
            phantom.halt();

            pagesVisited++;

            if(isLastUrl(plainUrl) || pagesVisited >= 20){
                console.log('THIS WAS THE LAST URL');
                grunt.file.write(fileName, JSON.stringify(videos));
            }

            (pagesVisited >= 20 || isLastUrl(plainUrl)) && done();
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
