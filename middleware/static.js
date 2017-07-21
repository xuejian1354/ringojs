const RFC_822 = "EEE, dd MMM yyyy HH:mm:ss z";

var objects = require("ringo/utils/objects");
var dates = require("ringo/utils/dates");
var response = require("ringo/jsgi/response");
var {mimeType} = require("ringo/mime");
var log = require("ringo/logging").getLogger(module.id);

exports.middleware = function static(next, app) {

    var resourceConfigs = [];

    app.static = function(base, index, baseURI, options) {
        var opts = objects.merge(options || {}, {
            "servePrecompressed": true,
            "dotfiles": "allow",
            "lastModified": true,
            "maxAge": 0,
            "setHeaders": null
        });
        var baseRepository;
        if (typeof base === "string") {
            baseRepository = getRepository(base);
        } else if (base instanceof org.ringojs.repository.Repository) {
            baseRepository = base;
        } else {
            throw new Error ("base must be of type String or Repository");
        }
        baseRepository.setRoot();
        resourceConfigs.push({
            repository: baseRepository,
            index: index,
            prefix: (typeof baseURI === "string" ? baseURI : ""),
            options: opts
        });
    };

    return function static(request) {
        for each (var config in resourceConfigs) {
            if (request.pathInfo.indexOf(config.prefix) === 0) {
                var path = request.pathInfo.substr(config.prefix.length);
                if (config.index && path.charAt(path.length-1) === "/") {
                    path += config.index;
                }
                if (path.length > 1) {
                    var resource = config.repository.getResource(path);
                    if (resource && resource.exists()) {
						log.info("STATIC " + request.pathInfo);

                        if (resource.getName().charAt(0) === ".") {
                            switch (config.options.dotfiles.toLowerCase()) {
                                case "deny": return response.text("403 Forbidden").setStatus(403);
                                case "ignore": return response.text("404 Not Found").setStatus(404);
                            }
                        }

                        let userHeaders = typeof config.options.setHeaders === "function" ? config.options.setHeaders() : {};

                        let defaultHeaders = {
                            "cache-control": "max-age=" + config.options.maxAge || 0
                        };

                        if (config.options.lastModified === true) {
                            defaultHeaders["last-modified"] = dates.format(new Date(resource.lastModified()), RFC_822, "en", "GMT");
                        }

                        // check if precompressed gzip resource is available and it's serving is enabled
                        let acceptEncoding = (request.headers["accept-encoding"] || "").toLowerCase();
                        if (acceptEncoding.indexOf("gzip") > -1 && config.options.servePrecompressed === true) {
                            let gzippedResource = config.repository.getResource(path + ".gz");
                            if (gzippedResource && gzippedResource.exists()) {
                                let jsgiResponse = response.static(gzippedResource, mimeType(path, "text/plain"));
                                jsgiResponse.headers = objects.merge(userHeaders, jsgiResponse.headers, {
                                    "content-encoding": "gzip"
                                }, defaultHeaders);
                                return jsgiResponse;
                            }
                        }

                        let jsgiResponse = response.static(resource, mimeType(path, "text/plain"));
                        jsgiResponse.headers = objects.merge(userHeaders, jsgiResponse.headers, defaultHeaders);
                        return jsgiResponse;
                    }
                }
            }
        }
        return next(request);
    };
};
