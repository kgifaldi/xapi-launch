var form = require("./form.js").form;
var fs = require("fs");
var utils = require("./utils.js");
var blockInDemoMode = require("./utils.js").blockInDemoMode;
var AdmZip = require('adm-zip');
var async = require('async');
var config = require("./config.js").config;
var ensureLoggedIn = utils.ensureLoggedIn(function(req, res, next)
{
	next();
});
var File = require("./types.js").file;
var Package = require("./types.js").package;
var request = require('request');


var userHasRole = require("./users.js").userHasRole;
var parseXml = require('xml2js').parseString;
exports.setup = function(app, DAL)
{

	app.post("/packages/upload/ple", ensureLoggedIn, form("./server/forms/uploadZipPle.json"), function(req, res, next)
	{
		var package = require("node-uuid").v4();
		var file = req.files.myfile;
		var zip = new AdmZip(file.buffer);
		var entries = zip.getEntries();
		var files = [];
		var manifest = null;

		async.eachSeries(entries, function(entry, nextEntry)
		{
			if (entry.isDirectory)
				return nextEntry();
			var _f = new File()
			_f.DB = DAL.DB;
			files.push(_f);
			_f.package = package;
			_f.owner = req.user.email;
			if (entry.entryName && require('path').parse(entry.entryName).base == 'coursePackage.xml')
			{
				manifest = _f;
			}
			_f.fromZipEntry(entry, nextEntry)
		}, function(err)
		{
			var defaultManifest = {
				title: file.originalFilename,
				description: "Generated from uploaded zip file.",
				url: "./index.html"
			}

			function postManifest(manifest)
			{
				console.log(manifest);
				var _p = new Package()
				_p.DB = DAL.DB;
				_p.id = package;
				_p.name = file.originalFilename;
				_p.owner = req.user.email;
				var contentRequest = {};
				contentRequest.url = ((config.host + "/") || "http://localhost:3000/") + "package/" + _p.id + "/" + manifest.url;
				contentRequest.title = manifest.title
				contentRequest.description = manifest.description;
				contentRequest.owner = req.user.email;
				contentRequest.packageLink = _p.id;
				contentRequest.iconURL = "/static/img/zip.png";
				contentRequest.launchType = "popup";
				DAL.registerContent(contentRequest, function(err, content)
				{
					_p.contentLink = content.key;
					_p.save(function()
					{
						res.redirect("/content/search/" + content.key + "/");
					})
				})
			}

			if (!manifest)
			postManifest(defaultManifest)
			else
			{
				manifest.getData(function(err, xml)
				{
					parseXml(xml.toString("utf8"), function(err, result)
					{
						if (err)
							return postManifest(defaultManifest);
						try
						{

							var au = result.courseStructure.au[0];
							
							postManifest(
							{
								title: au.title[0].langstring[0]._,
								description: au.description[0].langstring[0]._,
								url: au.url[0]
							});
						}
						catch (e)
						{
							console.log(e);
							return postManifest(defaultManifest);
						}
					});
				})
			}
		});

	});

	app.get("/packages/upload/", ensureLoggedIn, userHasRole("creator"), form("./server/forms/uploadZip.json"));
	app.post("/packages/upload/", ensureLoggedIn, userHasRole("creator"), form("./server/forms/uploadZip.json"), function(req, res, next)
	{
		var package = require("node-uuid").v4();
		var file = req.files.zip;
		var zip = new AdmZip(file.buffer);
		var entries = zip.getEntries();
		var files = [];
		var manifest = null;

		async.eachSeries(entries, function(entry, nextEntry)
		{
			if (entry.isDirectory)
				return nextEntry();
			var _f = new File()
			_f.DB = DAL.DB;
			files.push(_f);
			_f.package = package;
			_f.owner = req.user.email;
			if (entry.entryName && require('path').parse(entry.entryName).base == 'coursePackage.xml')
			{
				manifest = _f;
			}
			_f.fromZipEntry(entry, nextEntry)
		}, function(err)
		{
			var defaultManifest = {
				title: file.originalFilename,
				description: "Generated from uploaded zip file.",
				url: "./index.html"
			}

			function postManifest(manifest)
			{
				console.log(manifest);
				var _p = new Package()
				_p.DB = DAL.DB;
				_p.id = package;
				_p.name = file.originalFilename;
				_p.owner = req.user.email;
				var contentRequest = {};
				contentRequest.url = ((config.host + "/") || "http://localhost:3000/") + "package/" + _p.id + "/" + manifest.url;
				contentRequest.title = manifest.title
				contentRequest.description = manifest.description;
				contentRequest.owner = req.user.email;
				contentRequest.packageLink = _p.id;
				contentRequest.iconURL = "/static/img/zip.png";
				contentRequest.launchType = "popup";
				DAL.registerContent(contentRequest, function(err, content)
				{
					_p.contentLink = content.key;
					_p.save(function()
					{
						if(manifest == defaultManifest )
							res.redirect("/content/" + content.key + "/edit");
						else
							res.redirect("/content/search/" + content.key + "/");
					})
				})
			}


			if (!manifest)
				postManifest(defaultManifest)
			else
			{
				manifest.getData(function(err, xml)
				{
					parseXml(xml.toString("utf8"), function(err, result)
					{
						if (err)
							return postManifest(defaultManifest);
						try
						{

							var au = result.courseStructure.au[0];
							
							postManifest(
							{
								title: au.title[0].langstring[0]._,
								description: au.description[0].langstring[0]._,
								url: au.url[0]
							});
						}
						catch (e)
						{
							console.log(e);
							return postManifest(defaultManifest);
						}
					});
				})
			}
		});

	});

	function uploadCourseToPLE(req, res){
		

		console.log("gifaldi uploading course to PLE!");
		console.log("gifaldi req.files.zip: ", req.files.zip);
		var options = {
			method: "POST",
			url: "http://ple.dev.att.com/Publish/api/v1/upload/mm132b/87654321", // lrs.test.att.com:8001?statementId=xxxxxx
			headers: {
				"Content-Type": "multipart/form-data"
			},
			formData : {
				"myfile": req.files.zip.buffer
				//"myfile": fs.createReadStream(req.files.zip.originalFilename)
			}
		};

		console.log("gifaldi options set");

		/*
		req.pipe( request({
			url: "http://ple.dev.att.com/Publish/api/v1/upload/mm132b/62274899",
			method: "POST"
		}, function(error, response, body){
		
			console.error(error);
		
		})).on('error',function(e){
			console.log(e);
		}).pipe( res );
*/

		// call PLE upload endpoint        
		var lrs_request = request(options, function(err, resp, request_body){
			if(err){
				console.error("Error while sending statement to lrs: ", err);
			}
			//var headers = resp.headers;
			var statusCode = resp.statusCode;
			//res.status(statusCode).send(resp.body);
		    //res.status(statusCode).send(request_body);
			//console.log("Headers: ", headers);
			console.log("Status Code: ", statusCode);
			console.log("Body: ",request_body);
		})

	}

	function deletePackage(id, cb)
	{
		DAL.findPackage(
		{
			id: id,
		}, function(err, packages)
		{
			DAL.findFile(
			{
				package: id,
			}, function(err, files)
			{
				async.eachSeries(files, function(i, next)
				{
					i.deleteAndRemove(next)
				}, function()
				{
					packages[0].cleanAndDelete(function()
					{
						DAL.getContentByKey(packages[0].contentLink, function(err, content)
						{
							if (content)
							{
								content.remove(function()
								{
									cb(null)
								})
							}
							else
								cb(null);
						})
					})
				})
			})
		})



	}
	app.get("/packages/:id/delete", ensureLoggedIn, function(req, res, next)
	{
		DAL.findPackage(
		{
			id: req.params.id,
		}, function(err, packages)
		{
			if (!packages[0])
			{
				return res.status(404).send("package not found")
			}
			if (packages[0].owner !== req.user.email)
			{
				return res.status(401).send("Not authorized")
			}
			deletePackage(req.params.id, function(err)
			{
				res.redirect("/packages/");
			});
		});
	});
	app.get("/package/:id/*", function(req, res, next)
	{
		var query = {
			package: req.params.id,
			path: req.params[0] || "index.html"
		};
		DAL.findFile(query, function(err, files)
		{
			if (files[0])
			{
				files[0].getData(function(err, d)
				{
					res.contentType(require("path").extname(req.params[0] || "index.html")).send(d);;
				})
			}
			else
			{
				res.status(404).send();
			}
		})
	});
	app.get("/package/:id", function(req, res, next)
	{
		var query = {
			package: req.params.id,
		};
		DAL.findFile(query, function(err, files)
		{
			DAL.findPackage(
			{
				id: req.params.id
			}, function(err, package)
			{
				res.render("dirlist",
				{
					files: files,
					package: package[0],
					id: req.params.id
				})
			})
		});
	});
	app.get("/packages", ensureLoggedIn, function(req, res, next)
	{
		var query = {
			owner: req.user.email
		};
		DAL.findPackage(query, function(err, packages)
		{
			res.render("packagelist",
			{
				packages: packages,
				id: req.params.id
			})
		})
	});
	exports.deletePackage = deletePackage;
}