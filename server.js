
/**
 * Argument parser class.
 *
 * @class
 * @constructor
 */
function Parser() {
	"use strict";

	/**
	 * The list of arguments
	 */
	this.arguments = {};

	this.result = { "_": [] };
}

Parser.prototype = {

	/**
	 * Add an argument
	 */
	addargument: function (name, descriptor) {
		this.arguments[name] = descriptor;
		return this;
	},

	/**
	 * Print the help
	 */
	showhelp: function() {
		// get the max size (to align descriptions)
		var maxsize = 0;
		for (argument in this.arguments) {
			maxsize = argument.length > maxsize ? argument.length : maxsize;
		}

		// display the help
		for (argument in this.arguments) {
			var descriptor = this.arguments[argument],
				sep = "";
			for (var i = 0; i < maxsize - argument.length; ++i) {
				sep += " ";
			}
			console.log(argument + (descriptor.help ? (sep + "  : " + descriptor.help) : ""));
		}
	},

	/**
	 * Parse arguments
	 */
	parse: function (args) {
		for (var i = 0; i < args.length; ++i) {
			var arg = args[i];
			if (arg == "-h" || arg == "-help") {
				this.showhelp();
				return false;
			}
			if (this.arguments.hasOwnProperty(arg)) {
				var descriptor = this.arguments[arg];
				if (descriptor.positional) {
					this.result["_"].push(arg);
				} else if (i < args.length - 1) {
					this.result[arg] = args[i + 1];
					++i;
				} else {
					this.showhelp();
					return false;
				}
			} else {
				this.showhelp();
				return false;
			}
		}

		// add default values
		for (argument in this.arguments) {
			if (this.arguments[argument].positional !== true && this.result[argument] === undefined) {
				this.result[argument] = this.arguments[argument].def;
			}
		}

		return true;
	},

	/**
	 * Get the an argument by name
	 */
	getarg: function (name) {
		if (this.result.hasOwnProperty(name)) {
			return this.result[name];
		}

		for (var i = 0; i < this.result["_"].length; ++i) {
			if (this.result["_"][i] === name) {
				return true;
			}
		}

		return false;
	}

};


/**
 * Entry point of the server
 */
(function main() {
	"use strict";

	var http		= require("http"),
		zlib		= require("zlib"),
		url			= require("url"),
		path		= require("path"),
		fs			= require("fs"),
		args		= process.argv.slice(2),

		// supported file types
		fileTypes = {
			'.bin':		{ "type": "application/octet-stream",	"compress" : false },
			'.glsl':	{ "type": "text/plain",					"compress" : true },
			'.htm':		{ "type": "text/html",					"compress" : true },
			'.html':	{ "type": "text/html",					"compress" : true },
			'.css':		{ "type": "text/css",					"compress" : true },
			'.js':		{ "type": "text/javascript",			"compress" : true },
			'.json':	{ "type": "application/json",			"compress" : true },
			'.ttf':		{ "type": "application/x-font-ttf",		"compress" : true },
			'.png':		{ "type": "image/png",					"compress" : false },
			'.jpg':		{ "type": "image/jpeg",					"compress" : false },
			'.jpeg':	{ "type": "image/jpeg",					"compress" : false }
		},

		// the parser
		parser = (new Parser).
					addargument("-compress", { "positional": true, "help": "if used, will compress data before sending" }).
					addargument("-port", { "def": 8000, "help": "specify the port to use for listening" }).
					addargument("-log", { "positional": true, "help": "if used, will log what's happening" }).
					addargument("-lag", { "def": 0, "help": "set a delay in milliseconds before answering requests" });

	// process arguments
	if (parser.parse(args) === false) {
		return;
	}

	// get the options
	var compression	= parser.getarg("-compress"),
		log			= parser.getarg("-log"),
		port		= parser.getarg("-port"),
		lag			= parser.getarg("-lag");

	// print them
	console.log("compression : " + compression);
	console.log("log         : " + log);
	console.log("port        : " + port);
	console.log("lag         : " + (lag > 0 ? (lag + "ms") : "none"));

	// create a logging function
	log = log ? console.log : function () {};

	// start the server
	http.createServer(function (request, response) {

		for (var header in request.headers) {
			log("header:               " + header + " - " + request.headers[header]);
		}

		// compute the file name
		var	filename = path.join(process.cwd(), url.parse(request.url).pathname);

		log("full url:             " + request.url);
		log("url:                  " + url.parse(request.url).pathname);
		log("filename:             " + filename);

		// check if the url points to a folder, in which case, try to locate an index.html file
		if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) {
			// if the folder doesn't end with a slash, redirect
			if (request.url.charAt(request.url.length - 1) !== '/') {
				log("redirecting to:       " + request.url + "/");
				response.writeHead(302, { "Location": request.url + "/" });
				response.end();
				return;
			} else {
				filename = path.join(filename, "index.html");
			}
		}

		log("transformed filename: " + filename);

		// check if the file exists
		fs.exists(filename, function (exists) {

			// wait a bit before answering, if needed
			if (lag) {
				var start = Date.now();
				while (Date.now() - start < lag) { };
			}

			if (!exists) {

				// return 404 error if not found
				response.writeHead(404, { "Content-Type": "text/plain" });
				response.end("404 Not Found\n");
				log(filename + " - error 404");

			} else {

				// get the file type and create the header
				var fileType = fileTypes[path.extname(filename).toLowerCase()] || {},
					header = {};

				// set the content type
				if (fileType.type) {
					header["Content-Type"] = fileType.type;
				}

				// set the compression
				if (fileType.compress && compression) {
					header["Content-Encoding"] = "gzip";
				}

				// write the header
				response.writeHead(200, header);

				// stream the input, using gzip if necessary
				var inStream = fs.createReadStream(filename);
				if (fileType.compress && compression) {
					var zipper = zlib.createGzip();
					inStream.pipe(zipper).pipe(response);
					log(filename + " - ok 200 (compressed)");
				} else {
					inStream.pipe(response);
					log(filename + " - ok 200");
				}
			}

			log("");
		});

	}).listen(parseInt(port, 10));

	console.log("Static file server running at http://localhost:" + port + "/\nCTRL + C to shutdown");
})();
